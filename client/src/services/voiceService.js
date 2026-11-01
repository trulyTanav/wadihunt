import { socketService } from './socket';
import { sound } from '../audio/soundFX';

class VoiceService {
  constructor() {
    this.localStream = null;
    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.remoteAudioElements = new Map(); // peerId -> HTMLAudioElement
    this.audioContext = null;
    this.analyser = null;
    this.isMuted = false;
    this.isDeafened = false;
    this.isInVoice = false;
    this.activeChannel = 'GLOBAL'; // 'GLOBAL' | 'TEAM'
    this.listeners = new Set();
    this.speakingCheckInterval = null;
    this.wasSpeaking = false;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = {
      isInVoice: this.isInVoice,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      activeChannel: this.activeChannel,
      connectedPeerCount: this.peerConnections.size
    };
    this.listeners.forEach((l) => l(state));
  }

  async joinVoice(channel = 'GLOBAL') {
    if (this.isInVoice) return { success: true };

    try {
      this.activeChannel = channel;

      // 1. Capture microphone audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      this.localStream = stream;
      this.isMuted = false;
      this.isInVoice = true;

      // 2. Setup Voice Activity Detection (VAD) via Web Audio
      this.setupVAD(stream);

      // 3. Setup Socket Signaling listeners
      this.setupSignaling();

      // 4. Notify server of voice entry
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('voice_join', { channel });
      }

      sound.playVoiceJoin();
      this.notify();
      return { success: true };
    } catch (err) {
      console.warn('Voice join error / permission denied:', err);
      return { success: false, error: err.message || 'Microphone access denied' };
    }
  }

  setupVAD(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      if (this.speakingCheckInterval) clearInterval(this.speakingCheckInterval);

      this.speakingCheckInterval = setInterval(() => {
        if (!this.isInVoice || this.isMuted || !this.analyser) {
          if (this.wasSpeaking) {
            this.wasSpeaking = false;
            socketService.emit('voice_speaking', { isSpeaking: false });
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 18;

        if (isSpeaking !== this.wasSpeaking) {
          this.wasSpeaking = isSpeaking;
          socketService.emit('voice_speaking', { isSpeaking });
        }
      }, 150);
    } catch (e) {
      console.warn('VAD setup failed:', e);
    }
  }

  setupSignaling() {
    // When server returns list of peers already in voice
    this.unsubPeersList = socketService.on('voice_peers_list', (peers) => {
      const myId = socketService.getSocket()?.id;
      peers.forEach((peer) => {
        if (peer.id !== myId) {
          this.initiatePeerConnection(peer.id, true);
        }
      });
    });

    // When another peer joins voice
    this.unsubPeerJoined = socketService.on('voice_peer_joined', (peer) => {
      const myId = socketService.getSocket()?.id;
      if (peer.id !== myId) {
        sound.playVoiceJoin();
        // Newer peer doesn't initiate; older peer initiates
        this.initiatePeerConnection(peer.id, false);
      }
    });

    // When a peer leaves
    this.unsubPeerLeft = socketService.on('voice_peer_left', ({ peerId }) => {
      const myId = socketService.getSocket()?.id;
      if (peerId !== myId) {
        sound.playVoiceLeave();
      }
      this.cleanupPeer(peerId);
      this.notify();
    });

    // Incoming WebRTC Signal (Offer / Answer / Candidate)
    this.unsubSignal = socketService.on('voice_signal', async ({ senderPeerId, signal }) => {
      let pc = this.peerConnections.get(senderPeerId);
      if (!pc) {
        pc = this.createPeerConnection(senderPeerId);
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.emit('voice_signal', {
              targetPeerId: senderPeerId,
              signal: { sdp: pc.localDescription }
            });
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (iceErr) {
            console.warn('ICE Candidate add error:', iceErr);
          }
        }
      } catch (e) {
        console.warn('Signal handling error:', e);
      }
    });
  }

  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    // Add local mic audio track
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('voice_signal', {
          targetPeerId: peerId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Incoming audio stream from remote peer
    pc.ontrack = (event) => {
      let audioEl = this.remoteAudioElements.get(peerId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        this.remoteAudioElements.set(peerId, audioEl);
      }
      audioEl.srcObject = event.streams[0];
      audioEl.muted = this.isDeafened;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(peerId);
      }
      this.notify();
    };

    return pc;
  }

  async initiatePeerConnection(peerId, isInitiator) {
    const pc = this.createPeerConnection(peerId);
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.emit('voice_signal', {
          targetPeerId: peerId,
          signal: { sdp: pc.localDescription }
        });
      } catch (err) {
        console.warn('Error creating offer:', err);
      }
    }
  }

  cleanupPeer(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const audioEl = this.remoteAudioElements.get(peerId);
    if (audioEl) {
      if (audioEl.parentNode) audioEl.parentNode.removeChild(audioEl);
      this.remoteAudioElements.delete(peerId);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !this.isMuted;
      });
    }
    if (this.isMuted) {
      sound.playVoiceMute();
    } else {
      sound.playVoiceUnmute();
    }
    socketService.emit('voice_mute_toggle', { isMuted: this.isMuted });
    this.notify();
    return this.isMuted;
  }

  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    this.remoteAudioElements.forEach((el) => {
      el.muted = this.isDeafened;
    });
    if (this.isDeafened) {
      sound.playVoiceMute();
    } else {
      sound.playVoiceUnmute();
    }
    socketService.emit('voice_deafen_toggle', { isDeafened: this.isDeafened });
    this.notify();
    return this.isDeafened;
  }

  leaveVoice() {
    if (!this.isInVoice) return;
    sound.playVoiceLeave();

    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
      this.speakingCheckInterval = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    for (const [id] of this.peerConnections) {
      this.cleanupPeer(id);
    }

    if (this.unsubPeersList) this.unsubPeersList();
    if (this.unsubPeerJoined) this.unsubPeerJoined();
    if (this.unsubPeerLeft) this.unsubPeerLeft();
    if (this.unsubSignal) this.unsubSignal();

    socketService.emit('voice_leave');
    this.isInVoice = false;
    this.isMuted = false;
    this.wasSpeaking = false;
    this.notify();
  }
}

export const voiceService = new VoiceService();

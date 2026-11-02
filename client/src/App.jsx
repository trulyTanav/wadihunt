import React, { useState, useEffect, useRef } from 'react';
import { socketService } from './services/socket';
import { geoService } from './services/geolocation';
import { sound } from './audio/soundFX';
import { haptics } from './services/haptics';
import { SplashScreen } from '@capacitor/splash-screen';

import JoinCreateScreen from './components/JoinCreateScreen';
import LobbyView from './components/LobbyView';
import TacticalMap from './components/TacticalMap';
import TacticalHUD from './components/TacticalHUD';
import GameOverModal from './components/GameOverModal';
import SettingsModal from './components/SettingsModal';
import ChatAndVoiceModal from './components/ChatAndVoiceModal';
import { voiceService } from './services/voiceService';

export default function App() {
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem('wadihunt_player_name') || `Gateboy-${Math.floor(Math.random() * 900 + 100)}`;
    } catch (e) {
      return `Gateboy-${Math.floor(Math.random() * 900 + 100)}`;
    }
  });
  const [playerAvatar, setPlayerAvatar] = useState(() => {
    try {
      return localStorage.getItem('wadihunt_player_avatar') || 'wolf';
    } catch (e) {
      return 'wolf';
    }
  });
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [myPosition, setMyPosition] = useState({ lat: 37.7749, lng: -122.4194, heading: 0 });
  const [isSimulated, setIsSimulated] = useState(false);
  const [activePings, setActivePings] = useState([]);
  const [hunterTelemetry, setHunterTelemetry] = useState(null);
  const [shadowTelemetry, setShadowTelemetry] = useState(null);
  const [feedMessages, setFeedMessages] = useState([]);
  const [incidentAlert, setIncidentAlert] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [locateTargetCoord, setLocateTargetCoord] = useState(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const socketRef = useRef(null);
  const lastSentRef = useRef({ lat: 0, lng: 0, heading: 0, time: 0 });
  const wakeLockRef = useRef(null);

  // Keep phone screen awake during active matches
  useEffect(() => {
    const isGameRunning = roomState?.state === 'HEAD_START' || roomState?.state === 'ACTIVE';
    if (isGameRunning && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((lock) => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    } else if (!isGameRunning && wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [roomState?.state]);

  // Dismiss native splash screen as soon as React renders
  useEffect(() => {
    try {
      SplashScreen.hide().catch(() => {});
    } catch (e) {}
  }, []);

  // Initialize Socket and GPS
  useEffect(() => {
    const socket = socketService.connect();
    socketRef.current = socket;

    // Track connection
    const unsubConn = socketService.on('connection_change', ({ connected }) => {
      setIsConnected(connected);
    });

    // Room state update
    const unsubRoom = socketService.on('room_state', (state) => {
      setRoomState(state);
      if (state?.chatMessages) {
        setChatMessages(state.chatMessages);
      }
    });

    // Multiplayer live player moved (zero-delay position sync)
    const unsubMoved = socketService.on('player_moved', (data) => {
      setRoomState((prev) => {
        if (!prev || !prev.players) return prev;
        const idx = prev.players.findIndex((p) => p.id === data.id);
        if (idx === -1) {
          return {
            ...prev,
            players: [...prev.players, { ...data, lastUpdate: Date.now() }]
          };
        }
        const current = prev.players[idx];
        const updated = [...prev.players];
        updated[idx] = {
          ...current,
          lat: data.lat,
          lng: data.lng,
          heading: data.heading != null ? data.heading : current.heading,
          accuracy: data.accuracy != null ? data.accuracy : current.accuracy,
          speed: data.speed != null ? data.speed : current.speed,
          role: data.role || current.role,
          status: data.status || current.status,
          lastUpdate: Date.now()
        };
        return { ...prev, players: updated };
      });
    });

    // Time ticker
    const unsubTime = socketService.on('time_sync', (timeData) => {
      setRoomState((prev) => (prev ? { ...prev, ...timeData } : prev));
    });

    // Radar ping
    const unsubPing = socketService.on('radar_ping', ({ pings, duration }) => {
      sound.playRadarPing();
      haptics.radarPulse();
      setActivePings(pings);
      setRoomState((prev) => (prev ? { ...prev, isPingActive: true } : prev));
    });

    const unsubPingEnd = socketService.on('radar_ping_end', () => {
      setActivePings([]);
      setRoomState((prev) => (prev ? { ...prev, isPingActive: false } : prev));
    });

    // Telemetry
    const unsubHTel = socketService.on('hunter_telemetry', (data) => {
      setHunterTelemetry(data);
    });

    const unsubSTel = socketService.on('shadow_telemetry', (data) => {
      setShadowTelemetry(data);
      if (data.inCriticalDanger) {
        sound.playAlarm();
        haptics.dangerAlert();
      }
    });

    // Feed message
    const unsubFeed = socketService.on('feed_message', (msg) => {
      setFeedMessages((prev) => [...prev.slice(-30), msg]);
    });

    // Chat messages
    const unsubChat = socketService.on('chat_message', (msg) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]);
      sound.playNotification();
      haptics.tick();
      setChatOpen((open) => {
        if (!open) {
          setUnreadChatCount((count) => count + 1);
        }
        return open;
      });
    });

    // Voice state listener
    const unsubVoice = voiceService.subscribe((vState) => {
      setIsVoiceActive(vState.isInVoice);
    });

    // Voice peer joined & left state updates
    const unsubVoicePeerJoined = socketService.on('voice_peer_joined', (peer) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        const existing = prev.voicePeers || [];
        const idx = existing.findIndex(p => p.id === peer.id);
        const updated = idx >= 0
          ? existing.map(p => p.id === peer.id ? { ...p, ...peer } : p)
          : [...existing, peer];
        return { ...prev, voicePeers: updated };
      });
    });

    const unsubVoicePeerLeft = socketService.on('voice_peer_left', ({ peerId }) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        const existing = prev.voicePeers || [];
        return { ...prev, voicePeers: existing.filter(p => p.id !== peerId) };
      });
    });

    // Voice speaking updates (Discord-style)
    const unsubVoiceSpeaking = socketService.on('voice_speaking_update', ({ peerId, isSpeaking }) => {
      setRoomState((prev) => {
        if (!prev || !prev.voicePeers) return prev;
        return {
          ...prev,
          voicePeers: prev.voicePeers.map(p => p.id === peerId ? { ...p, isSpeaking } : p)
        };
      });
    });

    // Voice mute updates
    const unsubVoiceMute = socketService.on('voice_mute_update', ({ peerId, isMuted }) => {
      setRoomState((prev) => {
        if (!prev || !prev.voicePeers) return prev;
        return {
          ...prev,
          voicePeers: prev.voicePeers.map(p => p.id === peerId ? { ...p, isMuted } : p)
        };
      });
    });

    // Voice deafen updates
    const unsubVoiceDeafen = socketService.on('voice_deafen_update', ({ peerId, isDeafened }) => {
      setRoomState((prev) => {
        if (!prev || !prev.voicePeers) return prev;
        return {
          ...prev,
          voicePeers: prev.voicePeers.map(p => p.id === peerId ? { ...p, isDeafened } : p)
        };
      });
    });

    // Tag event with broadcast alert
    const unsubTag = socketService.on('player_tagged', (data) => {
      sound.playTagSound();
      haptics.tagImpact();
      if (data) {
        setIncidentAlert(data);
        setTimeout(() => {
          setIncidentAlert(null);
        }, 5000);
      }
    });

    // Match ended
    const unsubEnd = socketService.on('match_ended', ({ winner, summary }) => {
      setRoomState((prev) => (prev ? { ...prev, state: 'GAME_OVER', winner, summary } : prev));
    });

    // Subscribe to GPS with intelligent zero-delay throttling
    geoService.startTracking();
    const unsubGeo = geoService.subscribe((pos) => {
      setMyPosition(pos);

      // Send location update to server
      if (socket.connected && pos.lat != null && pos.lng != null) {
        const last = lastSentRef.current;
        const now = Date.now();
        const timeDiff = now - last.time;

        // Approx delta distance in meters
        const dLat = (pos.lat - last.lat) * 111111;
        const dLng = (pos.lng - last.lng) * 111111 * Math.cos((pos.lat * Math.PI) / 180);
        const distMoved = Math.hypot(dLat, dLng);
        const headingDiff = Math.abs((pos.heading || 0) - last.heading);

        const shouldSend =
          last.time === 0 ||
          distMoved >= 0.4 ||
          (headingDiff >= 4 && timeDiff >= 120) ||
          timeDiff >= 350;

        if (shouldSend && timeDiff >= 70) {
          lastSentRef.current = {
            lat: pos.lat,
            lng: pos.lng,
            heading: pos.heading || 0,
            time: now
          };

          socket.emit('update_location', {
            lat: pos.lat,
            lng: pos.lng,
            heading: pos.heading,
            accuracy: pos.accuracy,
            speed: pos.speed
          });
        }
      }
    });

    return () => {
      unsubConn();
      unsubRoom();
      unsubMoved();
      unsubTime();
      unsubPing();
      unsubPingEnd();
      unsubHTel();
      unsubSTel();
      unsubFeed();
      unsubChat();
      unsubVoice();
      unsubVoicePeerJoined();
      unsubVoicePeerLeft();
      unsubVoiceSpeaking();
      unsubVoiceMute();
      unsubVoiceDeafen();
      unsubTag();
      unsubEnd();
      unsubGeo();
      voiceService.leaveVoice();
      geoService.stopTracking();
    };
  }, []);

  const handleUpdatePlayerName = (name) => {
    setPlayerName(name);
    localStorage.setItem('wadihunt_player_name', name);
    if (socketService.getSocket()?.connected) {
      socketService.emit('update_profile', { name });
    }
  };

  const handleUpdatePlayerAvatar = (avatar) => {
    setPlayerAvatar(avatar);
    localStorage.setItem('wadihunt_player_avatar', avatar);
    if (socketService.getSocket()?.connected) {
      socketService.emit('update_profile', { avatar });
    }
  };

  const handleCreateRoom = () => {
    const coords = (myPosition?.lat != null) ? { lat: myPosition.lat, lng: myPosition.lng } : null;
    socketService.emit('create_room', { playerName, avatar: playerAvatar, coords }, (res) => {
      if (res.success) {
        setRoomState(res.state);
        // Center the initial safe zone around host's current GPS location
        if (coords) {
          socketService.emit('update_settings', {
            zoneCenter: coords
          });
        }
      }
    });
  };

  const handleJoinRoom = (roomCode, callback) => {
    const coords = (myPosition?.lat != null) ? { lat: myPosition.lat, lng: myPosition.lng } : null;
    socketService.emit('join_room', { roomCode, playerName, avatar: playerAvatar, coords }, (res) => {
      if (res.success) {
        setRoomState(res.state);
      }
      if (callback) callback(res);
    });
  };

  const handleSetRole = (role) => {
    socketService.emit('set_role', { role });
  };

  const handleHostSetPlayerRole = (targetPlayerId, role) => {
    socketService.emit('host_set_player_role', { targetPlayerId, role });
  };

  const handleAutoDistribute = (hunterCount) => {
    socketService.emit('auto_distribute_roles', { hunterCount });
  };

  const handleUpdateSettings = (newSettings) => {
    socketService.emit('update_settings', newSettings);
  };

  const handleAddBot = (role) => {
    socketService.emit('add_bot', { role });
  };

  const handleKickPlayer = (targetPlayerId) => {
    socketService.emit('kick_player', { targetPlayerId });
  };

  const handleStartGame = () => {
    // If zone center not yet set, set to current location
    if (!roomState?.settings?.zoneCenter && myPosition?.lat) {
      socketService.emit('update_settings', {
        zoneCenter: { lat: myPosition.lat, lng: myPosition.lng }
      });
    }
    socketService.emit('start_game');
  };

  const handleSelfTag = () => {
    socketService.emit('self_tag');
  };

  const handleHunterTagRunner = (shadowId) => {
    socketService.emit('hunter_tag_runner', { shadowId }, (res) => {
      if (!res.success && res.error) {
        console.warn('Tag notice:', res.error);
      }
    });
  };

  const handleResetToLobby = () => {
    socketService.emit('reset_to_lobby');
  };

  const handleSetZoneCenterCurrentGps = () => {
    if (myPosition?.lat && myPosition?.lng) {
      handleUpdateSettings({
        zoneCenter: { lat: myPosition.lat, lng: myPosition.lng }
      });
    }
  };

  // Simulation controls
  const handleToggleSimulated = (enabled) => {
    setIsSimulated(enabled);
    geoService.setSimulated(enabled, myPosition);
  };

  const handleMoveSimulated = (distanceMeters, bearingDegrees) => {
    geoService.moveSimulated(distanceMeters, bearingDegrees);
  };

  const handleMapClick = (lat, lng) => {
    if (isSimulated) {
      geoService.setSimulatedCoords(lat, lng);
    }
  };

  const handleSendChat = (text, channel) => {
    socketService.emit('send_chat', { text, channel });
  };

  const currentPlayer = roomState?.players?.find((p) => p.id === socketService.getSocket()?.id);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', background: '#0B0914' }}>
      {/* ── SCREEN 1: JOIN / CREATE LOBBY ──────────────────── */}
      {!roomState && (
        <JoinCreateScreen
          playerName={playerName}
          onUpdatePlayerName={handleUpdatePlayerName}
          playerAvatar={playerAvatar}
          onUpdatePlayerAvatar={handleUpdatePlayerAvatar}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isConnected={isConnected}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* ── SCREEN 2: LOBBY ROSTER & HOST CONTROLS ─────────── */}
      {roomState && roomState.state === 'LOBBY' && (
        <LobbyView
          roomState={roomState}
          currentPlayer={currentPlayer}
          playerName={playerName}
          onUpdatePlayerName={handleUpdatePlayerName}
          playerAvatar={playerAvatar}
          onUpdatePlayerAvatar={handleUpdatePlayerAvatar}
          onSetRole={handleSetRole}
          onHostSetPlayerRole={handleHostSetPlayerRole}
          onAutoDistribute={handleAutoDistribute}
          onUpdateSettings={handleUpdateSettings}
          onAddBot={handleAddBot}
          onKickPlayer={handleKickPlayer}
          onStartGame={handleStartGame}
          onSetZoneCenterCurrentGps={handleSetZoneCenterCurrentGps}
          onOpenChat={() => {
            setChatOpen(true);
            setUnreadChatCount(0);
          }}
          unreadChatCount={unreadChatCount}
          isVoiceActive={isVoiceActive}
        />
      )}

      {/* ── SCREEN 3: ACTIVE MATCH / HEAD START / MAP ──────── */}
      {roomState && (roomState.state === 'HEAD_START' || roomState.state === 'ACTIVE' || roomState.state === 'GAME_OVER') && (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Incident Elimination Notification Banner */}
          {incidentAlert && (
            <div className="incident-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}>
                  🚨
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-head)',
                    fontWeight: 800,
                    fontSize: '13px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#fff'
                  }}>
                    {incidentAlert.isInfected ? 'RUNNER INFECTED!' : 'RUNNER ELIMINATED!'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>
                    Gateboys caught <strong style={{ color: '#00F5D4' }}>{incidentAlert.shadowName || 'a Runner'}</strong>
                    {incidentAlert.hunterName ? ` (by ${incidentAlert.hunterName})` : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIncidentAlert(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
          )}

          <TacticalMap
            roomState={roomState}
            currentPlayer={currentPlayer}
            myPosition={myPosition}
            activePings={activePings}
            incidentAlert={incidentAlert}
            locateTargetCoord={locateTargetCoord}
            isSimulated={isSimulated}
            onMapClick={handleMapClick}
          />

          <TacticalHUD
            roomState={roomState}
            currentPlayer={currentPlayer}
            myPosition={myPosition}
            hunterTelemetry={hunterTelemetry}
            shadowTelemetry={shadowTelemetry}
            feedMessages={feedMessages}
            isSimulated={isSimulated}
            onMoveSimulated={handleMoveSimulated}
            onTagRunner={handleHunterTagRunner}
            onSelfTag={handleSelfTag}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenChat={() => {
              setChatOpen(true);
              setUnreadChatCount(0);
            }}
            unreadChatCount={unreadChatCount}
            isVoiceActive={isVoiceActive}
            onLocateTarget={(lat, lng) => setLocateTargetCoord({ lat, lng, time: Date.now() })}
          />

          {roomState.state === 'GAME_OVER' && (
            <GameOverModal
              roomState={roomState}
              currentPlayer={currentPlayer}
              onResetToLobby={handleResetToLobby}
            />
          )}
        </div>
      )}

      {/* Tactical Chat & Voice Lobby Drawer */}
      <ChatAndVoiceModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        currentPlayer={currentPlayer}
        roomState={roomState}
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        playerName={playerName}
        onUpdatePlayerName={handleUpdatePlayerName}
        playerAvatar={playerAvatar}
        onUpdatePlayerAvatar={handleUpdatePlayerAvatar}
        isSimulated={isSimulated}
        onToggleSimulated={handleToggleSimulated}
      />
    </div>
  );
}

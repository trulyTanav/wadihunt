import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  X, 
  Users, 
  ShieldAlert, 
  Radio, 
  PhoneOff, 
  Sparkles,
  Lock
} from 'lucide-react';
import { sound } from '../audio/soundFX';
import { haptics } from '../services/haptics';
import { voiceService } from '../services/voiceService';
import AvatarBadge from './AvatarBadge';

export default function ChatAndVoiceModal({
  isOpen,
  onClose,
  currentPlayer,
  roomState,
  chatMessages = [],
  onSendChat
}) {
  const isHunter = currentPlayer?.role === 'HUNTER';
  const defaultTab = isHunter ? 'GATEBOYS' : 'RUNNERS';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState({
    isInVoice: false,
    isMuted: false,
    isDeafened: false,
    activeChannel: 'GLOBAL',
    connectedPeerCount: 0
  });
  const [voiceError, setVoiceError] = useState('');
  const messagesEndRef = useRef(null);

  // Subscribe to voiceService changes
  useEffect(() => {
    const unsub = voiceService.subscribe((state) => {
      setVoiceState(state);
    });
    return unsub;
  }, []);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isOpen]);

  if (!isOpen) return null;

  // Filter messages based on active tab & role permissions
  const filteredMessages = (chatMessages || []).filter((msg) => {
    if (activeTab === 'ALL') return msg.channel === 'ALL';
    if (activeTab === 'GATEBOYS') return msg.channel === 'HUNTER';
    if (activeTab === 'RUNNERS') return msg.channel === 'SHADOW';
    return true;
  });

  const handleSend = (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim()) return;

    let targetChannel = 'ALL';
    if (activeTab === 'GATEBOYS') targetChannel = 'HUNTER';
    if (activeTab === 'RUNNERS') targetChannel = 'SHADOW';

    onSendChat(text.trim(), targetChannel);
    setInputText('');
    sound.playClick();
    haptics.tick();
  };

  const handleJoinVoice = async (channel = 'GLOBAL') => {
    setVoiceError('');
    sound.playClick();
    haptics.tick();
    const res = await voiceService.joinVoice(channel);
    if (!res.success) {
      setVoiceError(res.error || 'Failed to connect microphone');
    }
  };

  const handleLeaveVoice = () => {
    voiceService.leaveVoice();
    sound.playClick();
    haptics.tick();
  };

  const handleToggleMute = () => {
    voiceService.toggleMute();
    haptics.tick();
  };

  const handleToggleDeafen = () => {
    voiceService.toggleDeafen();
    haptics.tick();
  };

  // Quick Tactical callout presets
  const gateboyPresets = [
    '🎯 Flanking left!',
    '📍 Spotted near park!',
    '🏃 Pincer move north!',
    '⚡ Cut off exit east!',
    '🚨 Closing in (<20m)!'
  ];

  const runnerPresets = [
    '⚠️ Gateboy spotted!',
    '🏃 Heading to safe zone!',
    '🕶️ Hiding in alley!',
    '💨 Scatter and split up!',
    '✅ Clear of danger!'
  ];

  const voicePeers = roomState?.voicePeers || [];

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end', padding: 0 }}>
      <div className="chat-drawer">
        {/* Drawer Header & Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--line)',
          padding: '8px 12px 0 12px'
        }}>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '4px', flex: 1, overflowX: 'auto' }}>
            <button
              onClick={() => setActiveTab('ALL')}
              className={`chat-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            >
              🌍 ALL HUNT
            </button>

            {/* Gateboys Channel */}
            {(isHunter || roomState?.state === 'LOBBY' || roomState?.state === 'GAME_OVER') && (
              <button
                onClick={() => setActiveTab('GATEBOYS')}
                className={`chat-tab-btn gateboys ${activeTab === 'GATEBOYS' ? 'active gateboys' : ''}`}
              >
                🔴 GATEBOYS
              </button>
            )}

            {/* Runners Channel */}
            {(!isHunter || roomState?.state === 'LOBBY' || roomState?.state === 'GAME_OVER') && (
              <button
                onClick={() => setActiveTab('RUNNERS')}
                className={`chat-tab-btn runners ${activeTab === 'RUNNERS' ? 'active runners' : ''}`}
              >
                🟢 RUNNERS
              </button>
            )}

            {/* Voice Lobby Tab */}
            <button
              onClick={() => setActiveTab('VOICE')}
              className={`chat-tab-btn ${activeTab === 'VOICE' ? 'active' : ''}`}
              style={{
                color: voiceState.isInVoice ? '#10B981' : undefined,
                borderBottomColor: voiceState.isInVoice ? '#10B981' : undefined
              }}
            >
              <Mic size={14} className={voiceState.isInVoice ? 'pulse-animation' : ''} />
              VOICE {voicePeers.length > 0 ? `(${voicePeers.length})` : ''}
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── TAB CONTENT: VOICE CHAT LOBBY ──────────────────── */}
        {activeTab === 'VOICE' ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            overflowY: 'auto'
          }}>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: voiceState.isInVoice ? 'rgba(16, 185, 129, 0.12)' : 'rgba(11, 9, 20, 0.8)',
                border: `1px solid ${voiceState.isInVoice ? '#10B981' : 'var(--line)'}`,
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: voiceState.isInVoice ? '#10B981' : 'var(--p-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}>
                    <Mic size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'var(--font-head)' }}>
                      {voiceState.isInVoice ? 'LIVE VOICE: CONNECTED' : 'VOICE LOBBY: DISCONNECTED'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {voiceState.isInVoice
                        ? `${voicePeers.length} players currently in voice`
                        : 'Join to talk live with your squad'}
                    </div>
                  </div>
                </div>

                {voiceState.isInVoice ? (
                  <button
                    onClick={handleLeaveVoice}
                    className="btn btn-danger cut-sm"
                    style={{ minHeight: '34px', fontSize: '11px', padding: '0 10px' }}
                  >
                    <PhoneOff size={14} /> LEAVE
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoinVoice('GLOBAL')}
                    className="btn btn-primary cut-sm"
                    style={{ minHeight: '34px', fontSize: '11px', padding: '0 12px', background: '#10B981' }}
                  >
                    <Mic size={14} /> JOIN VOICE
                  </button>
                )}
              </div>

              {voiceError && (
                <div style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                  ⚠️ {voiceError}
                </div>
              )}

              {/* Connected Voice Roster */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.06em' }}>
                  PLAYERS IN VOICE ({voicePeers.length}):
                </div>
                {voicePeers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No one is in voice yet. Be the first to join!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                    {voicePeers.map((peer) => {
                      const isMe = peer.id === currentPlayer?.id;
                      const isSpeaking = peer.isSpeaking;
                      const isMuted = isMe ? voiceState.isMuted : peer.isMuted;
                      const isDeafened = isMe ? voiceState.isDeafened : peer.isDeafened;
                      const isPeerHunter = peer.role === 'HUNTER';

                      return (
                        <div
                          key={peer.id}
                          className={`discord-voice-card ${isSpeaking ? 'is-speaking' : ''}`}
                          style={{
                            background: isSpeaking ? 'rgba(34, 197, 94, 0.08)' : 'rgba(11, 9, 20, 0.85)',
                            border: `1.5px solid ${isSpeaking ? '#22C55E' : isMuted ? 'rgba(239, 68, 68, 0.4)' : 'var(--line)'}`,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: isSpeaking ? '0 0 16px rgba(34, 197, 94, 0.4)' : 'none'
                          }}
                        >
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div className={isSpeaking ? 'discord-speaking-avatar' : ''} style={{ borderRadius: '50%' }}>
                              <AvatarBadge
                                avatar={peer.avatar}
                                name={peer.name}
                                role={peer.role}
                                size={32}
                                border={!isSpeaking}
                              />
                            </div>

                            {/* Status corner icon: Deafened, Muted, or Speaking */}
                            {isDeafened ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '-3px',
                                  right: '-3px',
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: '#EF4444',
                                  border: '1.5px solid #000',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.6)'
                                }}
                                title="Deafened"
                              >
                                <VolumeX size={9} />
                              </span>
                            ) : isMuted ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '-3px',
                                  right: '-3px',
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: '#EF4444',
                                  border: '1.5px solid #000',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.6)'
                                }}
                                title="Muted"
                              >
                                <MicOff size={9} />
                              </span>
                            ) : isSpeaking ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '-3px',
                                  right: '-3px',
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: '#22C55E',
                                  border: '1.5px solid #000',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  boxShadow: '0 0 8px #22C55E'
                                }}
                                title="Speaking"
                              >
                                <Mic size={9} />
                              </span>
                            ) : null}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: isSpeaking ? 800 : 700,
                                color: isSpeaking ? '#22C55E' : '#fff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {peer.name} {isMe ? '(YOU)' : ''}
                              </div>
                              {isSpeaking && (
                                <div className="voice-equalizer" title="Speaking">
                                  <span className="bar" />
                                  <span className="bar" />
                                  <span className="bar" />
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                              <span style={{
                                fontSize: '9px',
                                fontFamily: 'var(--font-mono)',
                                color: isPeerHunter ? 'var(--hunter-color)' : 'var(--runner-color)'
                              }}>
                                {isPeerHunter ? 'GATEBOY' : 'RUNNER'}
                              </span>

                              {/* Discord-style mini status label */}
                              {isDeafened ? (
                                <span style={{
                                  fontSize: '8px',
                                  fontWeight: 800,
                                  color: '#EF4444',
                                  fontFamily: 'var(--font-mono)'
                                }}>
                                  DEAFENED
                                </span>
                              ) : isMuted ? (
                                <span style={{
                                  fontSize: '8px',
                                  fontWeight: 800,
                                  color: '#EF4444',
                                  fontFamily: 'var(--font-mono)'
                                }}>
                                  MUTED
                                </span>
                              ) : isSpeaking ? (
                                <span style={{
                                  fontSize: '8px',
                                  fontWeight: 800,
                                  color: '#22C55E',
                                  fontFamily: 'var(--font-mono)'
                                }}>
                                  TALKING
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Voice Controls (Mic & Speaker) */}
            {voiceState.isInVoice && (
              <div style={{
                display: 'flex',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid var(--line)'
              }}>
                <button
                  onClick={handleToggleMute}
                  className={`btn cut ${voiceState.isMuted ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ flex: 1, minHeight: '44px' }}
                >
                  {voiceState.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  {voiceState.isMuted ? 'UNMUTE MIC' : 'MUTE MIC'}
                </button>
                <button
                  onClick={handleToggleDeafen}
                  className={`btn cut ${voiceState.isDeafened ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ flex: 1, minHeight: '44px' }}
                >
                  {voiceState.isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  {voiceState.isDeafened ? 'UNDEAFEN' : 'DEAFEN'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── TAB CONTENT: TEXT CHAT STREAM ──────────────────── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Messages Scroll Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {filteredMessages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '30px 0',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}>
                  No messages yet in {activeTab}. Send a quick callout below!
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isMe = msg.senderId === currentPlayer?.id;
                  const isMsgHunter = msg.senderRole === 'HUNTER';
                  const roleColor = isMsgHunter ? 'var(--hunter-color)' : 'var(--runner-color)';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '82%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: roleColor }}>
                          {msg.senderName}
                        </span>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        style={{
                          background: isMe
                            ? (isHunter ? 'linear-gradient(135deg, #7A1428, #3D0A14)' : 'linear-gradient(135deg, #006655, #00332B)')
                            : 'var(--black)',
                          border: `1px solid ${isMe ? roleColor : 'var(--line)'}`,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: '#fff',
                          wordBreak: 'break-word',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Tactical Callout Chips */}
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '6px 14px',
              overflowX: 'auto',
              background: 'rgba(11, 9, 20, 0.7)',
              borderTop: '1px solid var(--line)'
            }}>
              {(activeTab === 'GATEBOYS' ? gateboyPresets : runnerPresets).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSend(preset)}
                  className="btn btn-ghost cut-sm"
                  style={{
                    fontSize: '11px',
                    minHeight: '26px',
                    padding: '0 8px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Message Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'var(--ink)',
                borderTop: '1px solid var(--line)'
              }}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${activeTab}...`}
                maxLength={180}
                className="cut-sm"
                style={{
                  flex: 1,
                  background: 'var(--black)',
                  border: '1px solid var(--line)',
                  color: '#fff',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="btn btn-primary cut-sm"
                style={{
                  minHeight: '38px',
                  padding: '0 14px',
                  opacity: inputText.trim() ? 1 : 0.5
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

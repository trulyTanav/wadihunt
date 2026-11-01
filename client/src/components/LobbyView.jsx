import React, { useState } from 'react';
import { 
  Users, 
  Shield, 
  Ghost, 
  Copy, 
  Check, 
  Play, 
  Plus, 
  Sliders, 
  Sparkles, 
  Trash2, 
  MapPin, 
  Clock, 
  Radio, 
  Share2,
  Camera,
  Edit2,
  MessageSquare,
  Mic
} from 'lucide-react';
import { sound } from '../audio/soundFX';
import { haptics } from '../services/haptics';
import AvatarBadge from './AvatarBadge';
import AvatarPickerModal from './AvatarPickerModal';

export default function LobbyView({
  roomState,
  currentPlayer,
  playerName,
  onUpdatePlayerName,
  playerAvatar,
  onUpdatePlayerAvatar,
  onSetRole,
  onHostSetPlayerRole,
  onAutoDistribute,
  onUpdateSettings,
  onAddBot,
  onKickPlayer,
  onStartGame,
  onSetZoneCenterCurrentGps,
  onOpenChat,
  unreadChatCount = 0,
  isVoiceActive = false
}) {
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [hunterSliderValue, setHunterSliderValue] = useState(1);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName || '');

  const isHost = currentPlayer?.isHost;
  const players = roomState?.players || [];
  const hunters = players.filter(p => p.role === 'HUNTER');
  const shadows = players.filter(p => p.role === 'SHADOW');
  const totalCount = players.length;

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomState?.code || '');
      setCopied(true);
      sound.playClick();
      haptics.tick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join my WadiHunt Game!',
        text: `Join real-world manhunt game lobby: ${roomState?.code}!`,
        url: window.location.href
      }).catch(() => {});
    } else {
      handleCopyCode();
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 'max(16px, env(safe-area-inset-top)) 20px max(16px, env(safe-area-inset-bottom)) 20px',
      overflowY: 'auto'
    }}>
      {/* ── TOP HEADER & ROOM CODE ───────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ 
              fontFamily: 'var(--font-head)', 
              fontSize: '26px', 
              fontWeight: 800, 
              letterSpacing: '-0.03em',
              color: '#fff' 
            }}>
              WADI<span style={{ color: 'var(--p-500)' }}>HUNT</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Real-world GPS Manhunt · {totalCount} {totalCount === 1 ? 'Player' : 'Players'} Ready
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenChat && (
              <button
                onClick={() => {
                  sound.playClick();
                  haptics.tick();
                  onOpenChat();
                }}
                className="btn btn-ghost cut-sm"
                style={{
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  position: 'relative',
                  border: isVoiceActive ? '1px solid #10B981' : undefined,
                  color: isVoiceActive ? '#10B981' : undefined
                }}
              >
                {isVoiceActive ? <Mic size={15} style={{ animation: 'pulse 1.5s infinite' }} /> : <MessageSquare size={15} />}
                <span>CHAT</span>
                {unreadChatCount > 0 && (
                  <span className="chat-badge" style={{ position: 'static', marginLeft: '2px' }}>
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>
            )}

            {/* Settings button */}
            {isHost && (
              <button
                onClick={() => {
                  setSettingsOpen(true);
                  sound.playClick();
                  haptics.tick();
                }}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '12px' }}
              >
                <Sliders size={16} /> RULES
              </button>
            )}
          </div>
        </div>

        {/* Room Code Banner */}
        <div className="cut-border">
          <div style={{
            background: 'var(--ink)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }} className="cut">
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                LOBBY CODE
              </div>
              <div style={{
                fontFamily: 'var(--font-head)',
                fontSize: '36px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: 'var(--p-300)'
              }}>
                {roomState?.code}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyCode}
                className="btn btn-ghost cut-sm"
                title="Copy Code"
              >
                {copied ? <Check size={16} color="var(--hunter-color)" /> : <Copy size={16} />}
                {copied ? 'COPIED' : 'COPY'}
              </button>
              <button
                onClick={handleShare}
                className="btn btn-ghost btn-icon cut-sm"
                title="Share Lobby"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Your Profile & Avatar Bar */}
        <div style={{
          background: 'var(--ink)',
          border: '1px solid var(--line)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }} className="cut-sm">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <AvatarBadge
                avatar={playerAvatar}
                name={playerName}
                role={currentPlayer?.role || 'HUNTER'}
                size={40}
                border={true}
                onClick={() => setAvatarModalOpen(true)}
              />
              <button
                onClick={() => setAvatarModalOpen(true)}
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--p-500)',
                  border: '1px solid var(--black)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Change Photo / Icon"
              >
                <Camera size={10} />
              </button>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                YOUR OPERATOR PROFILE
              </div>
              {editingName ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={16}
                    style={{
                      background: 'var(--black)',
                      border: '1px solid var(--p-500)',
                      color: '#fff',
                      padding: '2px 6px',
                      fontSize: '13px',
                      fontFamily: 'var(--font-head)',
                      borderRadius: '3px',
                      width: '120px'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (tempName.trim()) {
                        onUpdatePlayerName(tempName.trim());
                      }
                      setEditingName(false);
                    }}
                    className="btn btn-primary cut-sm"
                    style={{ minHeight: '24px', padding: '0 8px', fontSize: '10px' }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-head)', fontSize: '15px', fontWeight: 800 }}>
                    {playerName}
                  </span>
                  <button
                    onClick={() => {
                      setTempName(playerName);
                      setEditingName(true);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    title="Edit Codename"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setAvatarModalOpen(true)}
            className="btn btn-ghost cut-sm"
            style={{ fontSize: '11px', minHeight: '30px', padding: '0 10px' }}
          >
            <Camera size={13} color="var(--p-300)" /> PHOTO / ICON
          </button>
        </div>

        {/* Role Quick Selector for current player */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginTop: '4px'
        }}>
          <button
            onClick={() => {
              onSetRole('HUNTER');
              sound.playClick();
              haptics.tick();
            }}
            className="cut"
            style={{
              padding: '16px',
              border: currentPlayer?.role === 'HUNTER' ? '2px solid var(--hunter-color)' : '1px solid var(--line)',
              background: currentPlayer?.role === 'HUNTER' ? 'rgba(0, 245, 212, 0.15)' : 'var(--ink)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--hunter-color)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
              <Shield size={16} /> I am a Gateboy
            </div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, marginTop: '6px' }}>
              Track & Tag
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Follow pings, close distance, eliminate runners.
            </div>
          </button>

          <button
            onClick={() => {
              onSetRole('SHADOW');
              sound.playClick();
              haptics.tick();
            }}
            className="cut"
            style={{
              padding: '16px',
              border: currentPlayer?.role === 'SHADOW' ? '2px solid var(--shadow-color)' : '1px solid var(--line)',
              background: currentPlayer?.role === 'SHADOW' ? 'rgba(0, 245, 212, 0.15)' : 'var(--ink)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--shadow-color)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
              <Ghost size={16} /> I am a Runner
            </div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, marginTop: '6px' }}>
              Hide & Survive
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Stay inside the shrinking safe zone, outlast clock.
            </div>
          </button>
        </div>

        {/* ── HOST CONTROLS: ANY X HUNTERS / Y RUNNERS ─────── */}
        {isHost && (
          <div style={{
            background: 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }} className="cut">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p-300)' }}>
                <Sparkles size={14} /> HOST DISTRIBUTION TOOL
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure any <strong style={{ color: 'var(--hunter-color)' }}>{hunterSliderValue} Gateboys</strong> vs <strong style={{ color: 'var(--shadow-color)' }}>{Math.max(0, totalCount - hunterSliderValue)} Runners</strong>
              </div>
            </div>

            {/* Slider for X Gateboys */}
            {totalCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--hunter-color)', minWidth: '70px' }}>
                  {hunterSliderValue} Gateboys
                </span>
                <input
                  type="range"
                  min="1"
                  max={Math.max(1, totalCount - 1)}
                  value={hunterSliderValue}
                  onChange={(e) => setHunterSliderValue(parseInt(e.target.value, 10))}
                  style={{ flex: 1, accentColor: 'var(--p-500)', cursor: 'pointer' }}
                />
                <button
                  onClick={() => {
                    onAutoDistribute(hunterSliderValue);
                    sound.playClick();
                    haptics.tick();
                  }}
                  className="btn btn-primary cut-sm"
                  style={{ minHeight: '34px', fontSize: '12px' }}
                >
                  APPLY {hunterSliderValue}v{totalCount - hunterSliderValue}
                </button>
              </div>
            )}

            {/* Fast Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                onClick={() => {
                  setHunterSliderValue(1);
                  onAutoDistribute(1);
                  sound.playClick();
                }}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '11px', minHeight: '30px' }}
              >
                1 Gateboy vs All
              </button>
              <button
                onClick={() => {
                  const half = Math.max(1, Math.floor(totalCount / 2));
                  setHunterSliderValue(half);
                  onAutoDistribute(half);
                  sound.playClick();
                }}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '11px', minHeight: '30px' }}
              >
                50 / 50 Balanced
              </button>
              <button
                onClick={() => {
                  onAddBot('SHADOW');
                  sound.playClick();
                }}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '11px', minHeight: '30px', color: 'var(--shadow-color)' }}
              >
                + Add Runner Bot
              </button>
              <button
                onClick={() => {
                  onAddBot('HUNTER');
                  sound.playClick();
                }}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '11px', minHeight: '30px', color: 'var(--hunter-color)' }}
              >
                + Add Gateboy Bot
              </button>
              <button
                onClick={() => {
                  onSetZoneCenterCurrentGps();
                  sound.playClick();
                  haptics.tick();
                }}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '11px', minHeight: '30px' }}
                title="Center zone around your current GPS"
              >
                <MapPin size={12} /> Set Zone Here
              </button>
            </div>
          </div>
        )}

        {/* ── TEAMS ROSTER (HUNTERS vs SHADOWS) ─────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Gateboys Column */}
          <div style={{ background: 'var(--ink)', border: '1px solid var(--line)', padding: '12px' }} className="cut">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--line)'
            }}>
              <span style={{ color: 'var(--hunter-color)', fontWeight: 800, fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                GATEBOYS ({hunters.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {hunters.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    background: 'rgba(0, 245, 212, 0.08)',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <AvatarBadge avatar={p.avatar} name={p.name} role="HUNTER" size={24} border={false} />
                    <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name} {p.id === currentPlayer?.id ? '(YOU)' : ''} {p.isBot ? '🤖' : ''} {p.isHost ? '👑' : ''}
                    </span>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: p.isOnline === false ? 'var(--warning-color)' : p.lat != null ? 'var(--hunter-color)' : 'rgba(255,255,255,0.25)',
                        boxShadow: p.lat != null ? '0 0 6px var(--hunter-color)' : 'none',
                        display: 'inline-block'
                      }}
                      title={p.isOnline === false ? 'Connection unstable' : p.lat != null ? 'GPS Locked' : 'Waiting for GPS fix'}
                    />
                  </span>
                  {isHost && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => onHostSetPlayerRole(p.id, 'SHADOW')}
                        className="btn btn-ghost cut-sm"
                        style={{ minHeight: '22px', padding: '0 6px', fontSize: '10px' }}
                        title="Move to Runners"
                      >
                        → Runner
                      </button>
                      {p.isBot && (
                        <button
                          onClick={() => onKickPlayer(p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {hunters.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                  No gateboys assigned yet!
                </div>
              )}
            </div>
          </div>

          {/* Runners Column */}
          <div style={{ background: 'var(--ink)', border: '1px solid var(--line)', padding: '12px' }} className="cut">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--line)'
            }}>
              <span style={{ color: 'var(--shadow-color)', fontWeight: 800, fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                RUNNERS ({shadows.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {shadows.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    background: 'rgba(0, 245, 212, 0.08)',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <AvatarBadge avatar={p.avatar} name={p.name} role="SHADOW" size={24} border={false} />
                    <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name} {p.id === currentPlayer?.id ? '(YOU)' : ''} {p.isBot ? '🤖' : ''} {p.isHost ? '👑' : ''}
                    </span>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: p.isOnline === false ? 'var(--warning-color)' : p.lat != null ? 'var(--shadow-color)' : 'rgba(255,255,255,0.25)',
                        boxShadow: p.lat != null ? '0 0 6px var(--shadow-color)' : 'none',
                        display: 'inline-block'
                      }}
                      title={p.isOnline === false ? 'Connection unstable' : p.lat != null ? 'GPS Locked' : 'Waiting for GPS fix'}
                    />
                  </span>
                  {isHost && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => onHostSetPlayerRole(p.id, 'HUNTER')}
                        className="btn btn-ghost cut-sm"
                        style={{ minHeight: '22px', padding: '0 6px', fontSize: '10px' }}
                        title="Move to Gateboys"
                      >
                        → Gateboy
                      </button>
                      {p.isBot && (
                        <button
                          onClick={() => onKickPlayer(p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {shadows.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                  No runners assigned yet!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM LAUNCH BAR ────────────────────────────── */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isHost ? (
          <button
            onClick={() => {
              onStartGame();
              sound.playClick();
              haptics.tagImpact();
            }}
            className="btn btn-primary cut-lg"
            style={{
              width: '100%',
              minHeight: '56px',
              fontSize: '18px',
              letterSpacing: '0.04em'
            }}
            disabled={hunters.length === 0 || shadows.length === 0}
          >
            <Play size={20} fill="#fff" />
            START THE HUNT ({totalCount} PLAYERS)
          </button>
        ) : (
          <div style={{
            background: 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '14px',
            textAlign: 'center',
            fontSize: '14px',
            color: 'var(--text-muted)'
          }} className="cut">
            Waiting for host <strong style={{ color: '#fff' }}>{players.find(p => p.isHost)?.name || 'Host'}</strong> to start the hunt...
          </div>
        )}
      </div>

      {/* ── RULES & SETTINGS MODAL ───────────────────────── */}
      {settingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content cut">
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '20px' }}>
              Match Rules & Configuration
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Game Duration */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  MATCH DURATION
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[600, 900, 1800, 2700].map(sec => (
                    <button
                      key={sec}
                      onClick={() => onUpdateSettings({ gameDuration: sec })}
                      className={`btn cut-sm ${roomState?.settings?.gameDuration === sec ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, minHeight: '36px', fontSize: '12px' }}
                    >
                      {sec / 60}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Head Start */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  RUNNER HEAD START
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0, 60, 180, 300].map(sec => (
                    <button
                      key={sec}
                      onClick={() => onUpdateSettings({ headStartDuration: sec })}
                      className={`btn cut-sm ${roomState?.settings?.headStartDuration === sec ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, minHeight: '36px', fontSize: '12px' }}
                    >
                      {sec === 0 ? 'None' : `${sec / 60}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radar Ping Frequency */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  RADAR PING INTERVAL
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[60, 120, 180, 300].map(sec => (
                    <button
                      key={sec}
                      onClick={() => onUpdateSettings({ pingInterval: sec })}
                      className={`btn cut-sm ${roomState?.settings?.pingInterval === sec ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, minHeight: '36px', fontSize: '12px' }}
                    >
                      {sec / 60}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Safe Zone Starting Radius */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  INITIAL SAFE ZONE RADIUS
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[300, 500, 800, 1200].map(rad => (
                    <button
                      key={rad}
                      onClick={() => onUpdateSettings({ zoneRadius: rad })}
                      className={`btn cut-sm ${roomState?.settings?.zoneRadius === rad ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, minHeight: '36px', fontSize: '12px' }}
                    >
                      {rad}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Infection Mode Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderTop: '1px solid var(--line)'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Infection Mode</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Caught runners convert into gateboys immediately!
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={roomState?.settings?.infectionMode || false}
                  onChange={(e) => onUpdateSettings({ infectionMode: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--p-500)', cursor: 'pointer' }}
                />
              </div>
            </div>

            <button
              onClick={() => setSettingsOpen(false)}
              className="btn btn-white cut"
              style={{ marginTop: '10px' }}
            >
              SAVE & CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentAvatar={playerAvatar}
        currentName={playerName}
        onSave={onUpdatePlayerAvatar}
      />
    </div>
  );
}

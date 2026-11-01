import React, { useState } from 'react';
import { Shield, Ghost, Crosshair, Settings, ArrowRight, Play, Users, Camera, WifiOff } from 'lucide-react';
import { sound } from '../audio/soundFX';
import { haptics } from '../services/haptics';
import AvatarBadge from './AvatarBadge';
import AvatarPickerModal from './AvatarPickerModal';

export default function JoinCreateScreen({
  playerName,
  onUpdatePlayerName,
  playerAvatar,
  onUpdatePlayerAvatar,
  onCreateRoom,
  onJoinRoom,
  isConnected,
  onOpenSettings
}) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const handleCreate = () => {
    sound.playClick();
    haptics.tick();
    onCreateRoom();
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) {
      setErrorMsg('Please enter a room code');
      return;
    }
    sound.playClick();
    haptics.tick();
    onJoinRoom(roomCodeInput.trim().toUpperCase(), (res) => {
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to join room');
      }
    });
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 'max(20px, env(safe-area-inset-top)) 24px max(20px, env(safe-area-inset-bottom)) 24px',
      overflowY: 'auto'
    }}>
      {/* Top Navbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--p-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Crosshair size={18} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800 }}>
            Wadi<span style={{ color: 'var(--p-500)' }}>Hunt</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Connection status badge */}
          <button
            onClick={onOpenSettings}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              background: 'rgba(11, 9, 20, 0.8)',
              border: isConnected ? '1px solid var(--line)' : '1px solid var(--danger-color)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              color: '#fff'
            }}
            className="cut-sm"
            title="Click to check or configure server IP"
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? 'var(--runner-color)' : 'var(--danger-color)'
            }} />
            {isConnected ? 'ONLINE' : 'OFFLINE (TAP FOR IP)'}
          </button>

          <button
            onClick={onOpenSettings}
            className="btn btn-icon btn-ghost cut-sm"
            style={{ width: '36px', height: '36px', minHeight: '36px' }}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-head)',
            fontSize: 'clamp(32px, 7.5vw, 50px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.04em'
          }}>
            Your city is <em style={{ fontStyle: 'normal', color: 'var(--p-300)' }}>the&nbsp;map.</em>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>
            Gateboys vs Runners on real streets. High-accuracy real-time GPS Manhunt.
          </p>
        </div>

        {/* Offline Banner alert on Android / Web if server not reached */}
        {!isConnected && (
          <div style={{
            background: 'rgba(255, 0, 110, 0.12)',
            border: '1px solid var(--danger-color)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }} className="cut-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <WifiOff size={16} color="var(--danger-color)" />
              <span>Connecting to game server...</span>
            </div>
            <button
              onClick={onOpenSettings}
              className="btn btn-primary cut-sm"
              style={{ minHeight: '28px', padding: '0 10px', fontSize: '11px', background: 'var(--danger-color)' }}
            >
              Set Server IP
            </button>
          </div>
        )}

        {/* Player Profile & Avatar Card */}
        <div style={{
          background: 'var(--ink)',
          border: '1px solid var(--line)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }} className="cut">
          <div style={{ position: 'relative' }}>
            <AvatarBadge
              avatar={playerAvatar}
              name={playerName}
              role="HUNTER"
              size={56}
              onClick={() => setAvatarModalOpen(true)}
            />
            <button
              onClick={() => setAvatarModalOpen(true)}
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'var(--p-500)',
                border: '1.5px solid var(--black)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0
              }}
              title="Take Photo or Choose Icon"
            >
              <Camera size={12} />
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
              CODENAME & PHOTO ICON
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => onUpdatePlayerName(e.target.value)}
                placeholder="Agent Raven"
                maxLength={16}
                className="cut-sm"
                style={{
                  flex: 1,
                  background: 'var(--black)',
                  border: '1px solid var(--line)',
                  color: '#fff',
                  padding: '10px 12px',
                  fontSize: '15px',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  outline: 'none'
                }}
              />
              <button
                onClick={() => setAvatarModalOpen(true)}
                className="btn btn-ghost cut-sm"
                style={{ minHeight: '40px', padding: '0 12px', fontSize: '12px' }}
                title="Change Photo / Icon"
              >
                ICON
              </button>
            </div>
          </div>
        </div>

        {/* Action Choice: Create vs Join */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
          {/* Create Button */}
          <button
            onClick={handleCreate}
            className="btn btn-primary cut-lg"
            style={{ width: '100%', minHeight: '54px', fontSize: '16px' }}
          >
            <Play size={20} fill="#fff" />
            CREATE A NEW HUNT (HOST)
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>OR JOIN WITH CODE</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
          </div>

          {/* Join Form */}
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => {
                setRoomCodeInput(e.target.value.toUpperCase());
                setErrorMsg('');
              }}
              placeholder="CODE (e.g. WADI)"
              maxLength={6}
              className="cut-sm"
              style={{
                flex: 1,
                background: 'var(--ink)',
                border: errorMsg ? '1px solid var(--danger-color)' : '1px solid var(--line)',
                color: '#fff',
                padding: '14px 16px',
                fontSize: '16px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textAlign: 'center',
                textTransform: 'uppercase',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="btn btn-white cut-sm"
              style={{ minHeight: '52px', padding: '0 24px' }}
            >
              JOIN <ArrowRight size={18} />
            </button>
          </form>

          {errorMsg && (
            <div style={{ color: 'var(--danger-color)', fontSize: '13px', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* Feature Pills */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        padding: '14px 0',
        borderTop: '1px solid var(--line)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <strong style={{ color: '#fff', display: 'block' }}>2 to 50+</strong>
          Any Player Count
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <strong style={{ color: '#fff', display: 'block' }}>X vs Y</strong>
          Custom Roles
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <strong style={{ color: '#fff', display: 'block' }}>GPS Geofence</strong>
          Shrinking Storm Zone
        </div>
      </div>

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

import React, { useState } from 'react';
import { Settings, Server, Navigation, Volume2, X, Check, Camera } from 'lucide-react';
import { socketService } from '../services/socket';
import { sound } from '../audio/soundFX';
import { haptics } from '../services/haptics';
import AvatarBadge from './AvatarBadge';
import AvatarPickerModal from './AvatarPickerModal';

export default function SettingsModal({
  isOpen,
  onClose,
  playerName,
  onUpdatePlayerName,
  playerAvatar,
  onUpdatePlayerAvatar,
  isSimulated,
  onToggleSimulated
}) {
  if (!isOpen) return null;

  const [nameInput, setNameInput] = useState(playerName || '');
  const [serverUrlInput, setServerUrlInput] = useState(socketService.serverUrl);
  const [savedNotice, setSavedNotice] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const handleSave = () => {
    if (nameInput.trim()) {
      onUpdatePlayerName(nameInput.trim());
    }
    if (serverUrlInput.trim() !== socketService.serverUrl) {
      socketService.setServerUrl(serverUrlInput.trim());
    }
    setSavedNotice(true);
    sound.playClick();
    haptics.tick();
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content cut">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800 }}>
            <Settings size={20} color="var(--p-300)" /> SETTINGS
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Player Avatar & Codename */}
          <div>
            <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              OPERATOR PROFILE & ICON
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--black)',
              border: '1px solid var(--line)',
              padding: '10px 12px'
            }} className="cut-sm">
              <AvatarBadge
                avatar={playerAvatar}
                name={nameInput}
                role="HUNTER"
                size={44}
                border={true}
                onClick={() => setAvatarPickerOpen(true)}
              />
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={16}
                  placeholder="Codename"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '15px',
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={() => setAvatarPickerOpen(true)}
                className="btn btn-ghost cut-sm"
                style={{ fontSize: '11px', minHeight: '32px', padding: '0 10px' }}
              >
                <Camera size={13} color="var(--p-300)" /> CHANGE
              </button>
            </div>
          </div>

          {/* Multiplayer Server URL */}
          <div>
            <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              GAME SERVER URL (SOCKET.IO)
            </label>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              For Android devices on local WiFi, enter your host PC IP (e.g., <code>http://192.168.1.X:3001</code>)
            </div>
            <input
              type="text"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              className="cut-sm"
              style={{
                width: '100%',
                background: 'var(--black)',
                border: '1px solid var(--line)',
                color: '#fff',
                padding: '12px 14px',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                outline: 'none'
              }}
            />
          </div>

          {/* Simulation Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderTop: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Navigation size={16} color="var(--warning-color)" /> Mock GPS / Simulator Mode
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Enables on-screen D-Pad and map click to move anywhere indoors for testing.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isSimulated}
              onChange={(e) => onToggleSimulated(e.target.checked)}
              style={{ width: '22px', height: '22px', accentColor: 'var(--p-500)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button
            onClick={onClose}
            className="btn btn-ghost cut"
            style={{ flex: 1 }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary cut"
            style={{ flex: 1 }}
          >
            {savedNotice ? <Check size={18} /> : null}
            {savedNotice ? 'SAVED!' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        currentAvatar={playerAvatar}
        currentName={nameInput}
        onSave={(newAvatar) => {
          onUpdatePlayerAvatar(newAvatar);
        }}
      />
    </div>
  );
}

import React from 'react';

export const AVATAR_PRESETS = [
  { id: 'wolf', name: 'Wolf', emoji: '🐺', desc: 'Apex Predator' },
  { id: 'raven', name: 'Raven', emoji: '🦅', desc: 'Aerial Recon' },
  { id: 'viper', name: 'Viper', emoji: '🐍', desc: 'Strike Specialist' },
  { id: 'ghost', name: 'Ghost', emoji: '👻', desc: 'Stealth Shadow' },
  { id: 'skull', name: 'Skull', emoji: '💀', desc: 'Reaper' },
  { id: 'target', name: 'Target', emoji: '🎯', desc: 'Deadeye' },
  { id: 'cyber', name: 'Volt', emoji: '⚡', desc: 'High Voltage' },
  { id: 'fox', name: 'Fox', emoji: '🦊', desc: 'Tactical Agility' }
];

export function getAvatarEmoji(avatarId) {
  const found = AVATAR_PRESETS.find(p => p.id === avatarId);
  return found ? found.emoji : null;
}

export default function AvatarBadge({
  avatar,
  name = '',
  role = 'HUNTER',
  size = 36,
  border = true,
  onClick = null
}) {
  const isHunter = role === 'HUNTER';
  const themeColor = isHunter ? 'var(--hunter-color, #FF2A55)' : 'var(--runner-color, #00F5D4)';
  const isPhoto = avatar && (avatar.startsWith('data:image/') || avatar.startsWith('http'));
  const presetEmoji = avatar ? getAvatarEmoji(avatar) : null;

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(11, 9, 20, 0.95)',
    border: border ? `2px solid ${themeColor}` : 'none',
    boxShadow: border ? `0 0 10px ${themeColor}40` : 'none',
    cursor: onClick ? 'pointer' : 'default',
    position: 'relative',
    userSelect: 'none'
  };

  return (
    <div style={style} onClick={onClick} title={name}>
      {isPhoto ? (
        <img
          src={avatar}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : presetEmoji ? (
        <span style={{ fontSize: `${Math.round(size * 0.52)}px`, lineHeight: 1 }}>
          {presetEmoji}
        </span>
      ) : (
        <span style={{
          fontSize: `${Math.round(size * 0.42)}px`,
          fontWeight: 800,
          fontFamily: 'var(--font-head)',
          color: themeColor,
          textTransform: 'uppercase'
        }}>
          {name ? name.slice(0, 2) : (isHunter ? 'H' : 'S')}
        </span>
      )}
    </div>
  );
}

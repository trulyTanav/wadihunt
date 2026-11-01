import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, X, Sparkles, RefreshCw } from 'lucide-react';
import AvatarBadge, { AVATAR_PRESETS } from './AvatarBadge';
import { sound } from '../audio/soundFX';
import { haptics } from '../services/haptics';

export default function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatar,
  currentName,
  onSave
}) {
  if (!isOpen) return null;

  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || 'wolf');
  const [previewPhoto, setPreviewPhoto] = useState(
    currentAvatar && (currentAvatar.startsWith('data:image/') || currentAvatar.startsWith('http'))
      ? currentAvatar
      : null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputCameraRef = useRef(null);
  const fileInputGalleryRef = useRef(null);

  // Resize and compress an image file to a lightweight 96x96 data URL
  const processImageFile = (file) => {
    if (!file) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 96;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Square centered crop
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        // Convert to high-quality compressed JPEG (typically ~3.5KB)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setPreviewPhoto(dataUrl);
        setSelectedAvatar(dataUrl);
        setIsProcessing(false);
        sound.playClick();
        haptics.tick();
      };
      img.onerror = () => {
        setIsProcessing(false);
        alert('Failed to process photo.');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSelectPreset = (presetId) => {
    setSelectedAvatar(presetId);
    setPreviewPhoto(null);
    sound.playClick();
    haptics.tick();
  };

  const handleConfirm = () => {
    sound.playClick();
    haptics.tick();
    onSave(selectedAvatar);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content cut" style={{ maxWidth: '420px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-head)',
            fontSize: '18px',
            fontWeight: 800
          }}>
            <Camera size={20} color="var(--p-300)" />
            TACTICAL ICON & PHOTO
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          padding: '16px',
          background: 'var(--black)',
          border: '1px solid var(--line)'
        }} className="cut-sm">
          <AvatarBadge
            avatar={selectedAvatar}
            name={currentName}
            role="HUNTER"
            size={76}
            border={true}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              {currentName || 'Agent'}
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {previewPhoto ? 'Custom Photo Avatar' : `Badge: ${selectedAvatar.toUpperCase()}`}
            </div>
          </div>
        </div>

        {/* Hidden File Inputs */}
        {/* Camera input with capture="user" for direct selfie/camera snap on Android */}
        <input
          type="file"
          ref={fileInputCameraRef}
          accept="image/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {/* Gallery file upload input */}
        <input
          type="file"
          ref={fileInputGalleryRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Photo Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={() => fileInputCameraRef.current?.click()}
            className="btn btn-ghost cut-sm"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            disabled={isProcessing}
          >
            <Camera size={16} color="var(--p-300)" />
            {isProcessing ? 'Processing...' : 'Take Photo'}
          </button>

          <button
            onClick={() => fileInputGalleryRef.current?.click()}
            className="btn btn-ghost cut-sm"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            disabled={isProcessing}
          >
            <Upload size={16} />
            Choose Photo
          </button>
        </div>

        {/* Tactical Preset Badges */}
        <div>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            letterSpacing: '0.08em'
          }}>
            OR SELECT TACTICAL OPERATOR BADGE
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}>
            {AVATAR_PRESETS.map((p) => {
              const isSelected = selectedAvatar === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className="cut-sm"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '10px 4px',
                    background: isSelected ? 'rgba(124, 77, 255, 0.22)' : 'var(--ink)',
                    border: isSelected ? '1px solid var(--p-500)' : '1px solid var(--line)',
                    color: '#fff',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{p.emoji}</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={onClose}
            className="btn btn-ghost cut"
            style={{ flex: 1 }}
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary cut"
            style={{ flex: 1.4 }}
          >
            <Check size={18} />
            APPLY ICON
          </button>
        </div>
      </div>
    </div>
  );
}

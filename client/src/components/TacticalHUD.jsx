import React, { useState } from 'react';
import { 
  Radio, 
  Compass, 
  AlertTriangle, 
  Target, 
  Skull, 
  Clock, 
  ShieldAlert, 
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare,
  Mic
} from 'lucide-react';
import { sound } from '../audio/soundFX';
import { haptics } from '../services/haptics';
import AvatarBadge from './AvatarBadge';

export default function TacticalHUD({
  roomState,
  currentPlayer,
  myPosition,
  hunterTelemetry,
  shadowTelemetry,
  feedMessages = [],
  isSimulated = false,
  onMoveSimulated,
  onTagRunner,
  onSelfTag,
  onOpenSettings,
  onOpenChat,
  unreadChatCount = 0,
  isVoiceActive = false,
  onLocateTarget = null
}) {
  const [confirmTagModal, setConfirmTagModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const isHunter = currentPlayer?.role === 'HUNTER';
  const isShadow = currentPlayer?.role === 'SHADOW';
  const isAlive = currentPlayer?.status === 'ALIVE';
  const isHeadStart = roomState?.state === 'HEAD_START';
  const isActive = roomState?.state === 'ACTIVE';

  // Format time mm:ss
  const formatTime = (seconds) => {
    if (seconds == null || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    haptics.tick();
  };

  // Bearing needle rotation relative to player's heading
  const targetBearing = isHunter 
    ? (hunterTelemetry?.nearestBearing ?? 0)
    : (shadowTelemetry?.nearestHunterBearing ?? 0);
  
  const relativeAngle = (targetBearing - (myPosition?.heading || 0) + 360) % 360;

  const targetDist = isHunter
    ? hunterTelemetry?.nearestDistance
    : shadowTelemetry?.nearestHunterDistance;

  const canTag = isHunter && hunterTelemetry?.canTag;
  const inDanger = isShadow && shadowTelemetry?.inDanger;
  const inCriticalDanger = isShadow && shadowTelemetry?.inCriticalDanger;

  const activelySpeakingPeer = roomState?.voicePeers?.find(
    (p) => p.isSpeaking && p.id !== currentPlayer?.id
  ) || roomState?.voicePeers?.find((p) => p.isSpeaking);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 'max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom)) 16px',
      zIndex: 1000
    }}>
      {/* ── TOP HUD BAR (Seamless Mobile Responsive Layout) ──── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {/* TIER 1: HEADER & ACTION CONTROLS (Settings is ALWAYS visible & never cut off!) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          pointerEvents: 'auto'
        }}>
          {/* Operator Identity Chip */}
          <div className="telemetry-chip cut-sm" style={{ padding: '4px 10px', gap: '8px', flexShrink: 0 }}>
            <AvatarBadge
              avatar={currentPlayer?.avatar}
              name={currentPlayer?.name}
              role={currentPlayer?.role}
              size={24}
              border={true}
            />
            <div>
              <span className="label" style={{ fontSize: '8px' }}>
                {currentPlayer?.role === 'HUNTER' ? 'GATEBOY' : currentPlayer?.role === 'SHADOW' ? 'RUNNER' : 'OPERATOR'}
              </span>
              <div style={{ fontSize: '12px', fontWeight: 700, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentPlayer?.name || 'Agent'}
              </div>
            </div>
          </div>

          {/* Discord-Style Active Speaker Pill (Shows whose mic noise is coming from on the HUD!) */}
          {activelySpeakingPeer && (
            <div
              className="hud-voice-speech-pill"
              onClick={onOpenChat}
              style={{ cursor: 'pointer', flexShrink: 1, minWidth: 0 }}
              title="Click to open voice chat"
            >
              <div className="voice-equalizer">
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#22C55E',
                  maxWidth: '75px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {activelySpeakingPeer.name}
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>talking</span>
              </div>
            </div>
          )}

          {/* Quick controls: Chat/Voice, Sound & Settings (NEVER cut off!) */}
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={onOpenChat}
              className="btn btn-icon cut-sm"
              style={{
                position: 'relative',
                width: '36px',
                height: '36px',
                minHeight: '36px',
                background: 'rgba(11, 9, 20, 0.88)',
                border: isVoiceActive ? '1px solid #10B981' : '1px solid var(--line)',
                color: isVoiceActive ? '#10B981' : 'var(--p-300)'
              }}
              title="Open Chat & Voice"
            >
              <MessageSquare size={16} />
              {unreadChatCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: 'var(--p-500)',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 4px',
                    lineHeight: 1
                  }}
                >
                  {unreadChatCount}
                </span>
              )}
              {isVoiceActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '3px',
                    right: '3px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#10B981'
                  }}
                />
              )}
            </button>
            <button
              onClick={handleToggleSound}
              className="btn btn-icon cut-sm"
              style={{
                width: '36px',
                height: '36px',
                minHeight: '36px',
                background: 'rgba(11, 9, 20, 0.88)',
                border: '1px solid var(--line)',
                color: isMuted ? 'var(--text-muted)' : 'var(--p-300)'
              }}
              title="Toggle sound"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={onOpenSettings}
              className="btn btn-icon cut-sm"
              style={{
                width: '36px',
                height: '36px',
                minHeight: '36px',
                background: 'rgba(11, 9, 20, 0.88)',
                border: '1px solid var(--line)',
                color: 'var(--p-300)'
              }}
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* TIER 2: UNIFIED TELEMETRY STRIP (3 equal columns - perfectly fits any phone width!) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          width: '100%',
          pointerEvents: 'auto'
        }}>
          {/* Match / Head Start Timer */}
          <div className="telemetry-chip cut-sm" style={{ padding: '4px 6px', width: '100%', justifyContent: 'center' }}>
            <Clock size={13} color="var(--p-300)" />
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <span className="label" style={{ fontSize: '8px' }}>
                {isHeadStart ? 'HEAD START' : 'MATCH TIME'}
              </span>
              <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {isHeadStart 
                  ? formatTime(roomState?.headStartRemaining)
                  : formatTime(roomState?.matchRemaining)}
              </div>
            </div>
          </div>

          {/* Radar Ping Meter */}
          <div className={`telemetry-chip cut-sm ${roomState?.isPingActive ? 'active' : ''}`}
               style={{
                 padding: '4px 6px',
                 width: '100%',
                 justifyContent: 'center',
                 borderColor: roomState?.isPingActive ? 'var(--p-500)' : 'var(--line)',
                 boxShadow: roomState?.isPingActive ? '0 0 14px var(--p-500)' : 'none'
               }}>
            <Radio size={13} className={roomState?.isPingActive ? 'pulse-animation' : ''} />
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <span className="label" style={{ fontSize: '8px' }}>RADAR PING</span>
              <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {roomState?.isPingActive 
                  ? '⚡ ACTIVE' 
                  : formatTime(roomState?.nextPingCountdown)}
              </div>
            </div>
          </div>

          {/* Safe Zone Diameter */}
          <div className="telemetry-chip cut-sm" style={{ padding: '4px 6px', width: '100%', justifyContent: 'center' }}>
            <ShieldAlert size={13} color="var(--p-300)" />
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <span className="label" style={{ fontSize: '8px' }}>ZONE RADIUS</span>
              <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {roomState?.currentZoneRadius || 500}m
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Head Start Overlay Warning */}
        {isHeadStart && (
          <div className="cut-border" style={{ pointerEvents: 'auto' }}>
            <div style={{
              background: isHunter ? '#1D1438' : '#140E26',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }} className="cut">
              <div>
                <div style={{ 
                  color: isHunter ? 'var(--warning-color)' : 'var(--hunter-color)',
                  fontWeight: 800,
                  fontSize: '13px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  {isHunter ? 'STAND BY: RUNNERS ARE SCATTERING' : 'RUN! HEAD START IN PROGRESS'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {isHunter ? 'Radar is blind until countdown expires.' : 'Reach cover before gateboys are released!'}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '18px',
                fontWeight: 700,
                color: '#fff'
              }}>
                {formatTime(roomState?.headStartRemaining)}
              </div>
            </div>
          </div>
        )}

        {/* Danger Warning Banner for Shadows */}
        {isActive && isShadow && isAlive && inDanger && (
          <div className="cut-border-danger pulse-animation" style={{ pointerEvents: 'auto' }}>
            <div style={{
              background: '#2A0814',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }} className="cut">
              <AlertTriangle size={20} color="var(--danger-color)" />
              <div>
                <div style={{ color: 'var(--danger-color)', fontWeight: 800, fontSize: '12px' }}>
                  {inCriticalDanger ? '🚨 CRITICAL: GATEBOY WITHIN 15 METERS!' : '⚠️ WARNING: GATEBOY CLOSING IN (<30m)'}
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '11px' }}>
                  Distance: {targetDist}m · Change direction and break line of sight!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TIER 3: PRECISION & TARGET ROW */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: (isActive && targetDist != null) ? 'space-between' : 'flex-start',
          gap: '8px',
          width: '100%',
          pointerEvents: 'auto'
        }}>
          {/* GPS Precision Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(11, 9, 20, 0.88)',
              border: '1px solid var(--line)',
              padding: '4px 8px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              backdropFilter: 'blur(6px)',
              flexShrink: 0
            }}
            className="cut-sm"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: myPosition?.hasRealLock ? 'var(--hunter-color)' : 'var(--warning-color)',
                boxShadow: myPosition?.hasRealLock ? '0 0 8px var(--hunter-color)' : 'none'
              }}
            />
            <span>
              {isSimulated
                ? 'MOCK GPS'
                : myPosition?.hasRealLock
                ? `GPS ±${Math.round(myPosition?.accuracy || 4)}m`
                : 'ACQUIRING...'}
            </span>
          </div>

          {/* Target Tracker Pill */}
          {isActive && targetDist != null && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: canTag ? 'rgba(255, 42, 85, 0.28)' : 'rgba(11, 9, 20, 0.92)',
              border: `1.5px solid ${canTag ? 'var(--danger-color)' : isHunter ? 'var(--hunter-color)' : 'var(--p-500)'}`,
              padding: '4px 10px',
              borderRadius: '20px',
              boxShadow: canTag ? '0 0 20px rgba(255, 42, 85, 0.6)' : '0 4px 14px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              minWidth: 0
            }}>
              {/* Direction Arrow Needle */}
              <div style={{
                transform: `rotate(${relativeAngle}deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s ease-out',
                flexShrink: 0
              }}>
                <Navigation
                  size={14}
                  fill={isHunter ? '#FF2A55' : '#00F5D4'}
                  color={isHunter ? '#FF2A55' : '#00F5D4'}
                />
              </div>

              {/* Target & Distance text */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isHunter ? (hunterTelemetry?.nearestShadowName ? `TARGET: ${hunterTelemetry.nearestShadowName}` : 'RUNNER') : 'GATEBOY'}
                </span>
                <strong style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: canTag ? 'var(--danger-color)' : '#fff',
                  fontWeight: 800
                }}>
                  {targetDist}m
                </strong>
              </div>

              {/* Hunter Target Locate Button */}
              {isHunter && hunterTelemetry?.nearestShadowLat != null && onLocateTarget && (
                <button
                  onClick={() => onLocateTarget(hunterTelemetry.nearestShadowLat, hunterTelemetry.nearestShadowLng)}
                  className="btn btn-ghost cut-sm"
                  style={{
                    minHeight: '22px',
                    padding: '0 6px',
                    fontSize: '9px',
                    color: 'var(--hunter-color)',
                    border: '1px solid var(--hunter-color)',
                    flexShrink: 0
                  }}
                  title="Pan map to nearest runner"
                >
                  LOCATE
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center of screen is now completely OPEN & UNOBSTRUCTED for the map and player puck! */}
      <div style={{ pointerEvents: 'none' }} />

      {/* ── BOTTOM HUD CONTROLS & FEED ─────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'auto'
      }}>
        {/* Virtual D-Pad for Simulation Mode */}
        {isSimulated && (
          <div style={{
            alignSelf: 'center',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 44px)',
            gridTemplateRows: 'repeat(2, 44px)',
            gap: '6px',
            background: 'rgba(11, 9, 20, 0.9)',
            padding: '8px',
            border: '1px solid var(--warning-color)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }} className="cut">
            <div></div>
            <button
              onClick={() => onMoveSimulated(10, 0)}
              className="btn btn-icon cut-sm"
              style={{ background: 'var(--ink-2)', color: 'var(--p-300)', border: '1px solid var(--line)' }}
              title="Move North"
            >
              <ArrowUp size={20} />
            </button>
            <div></div>

            <button
              onClick={() => onMoveSimulated(10, 270)}
              className="btn btn-icon cut-sm"
              style={{ background: 'var(--ink-2)', color: 'var(--p-300)', border: '1px solid var(--line)' }}
              title="Move West"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => onMoveSimulated(10, 180)}
              className="btn btn-icon cut-sm"
              style={{ background: 'var(--ink-2)', color: 'var(--p-300)', border: '1px solid var(--line)' }}
              title="Move South"
            >
              <ArrowDown size={20} />
            </button>
            <button
              onClick={() => onMoveSimulated(10, 90)}
              className="btn btn-icon cut-sm"
              style={{ background: 'var(--ink-2)', color: 'var(--p-300)', border: '1px solid var(--line)' }}
              title="Move East"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Action Buttons: Hunter Tag or Runner Confession */}
        {isActive && isAlive && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {isHunter ? (
              <button
                onClick={() => onTagRunner(hunterTelemetry?.nearestShadowId)}
                className={`btn cut-lg ${canTag ? 'btn-danger pulse-animation' : 'btn-ghost'}`}
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  minHeight: '54px',
                  fontSize: '16px',
                  opacity: canTag ? 1 : 0.65,
                  cursor: canTag ? 'pointer' : 'not-allowed'
                }}
                disabled={!canTag}
              >
                <Target size={20} />
                {canTag ? `TAG RUNNER (${targetDist}m - IN RANGE!)` : `TAG RUNNER (GET WITHIN 12m · CURRENT: ${targetDist ?? '?'}m)`}
              </button>
            ) : (
              <button
                onClick={() => setConfirmTagModal(true)}
                className="btn btn-white cut-lg"
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  minHeight: '52px',
                  fontSize: '16px',
                  letterSpacing: '0.04em'
                }}
              >
                <Skull size={20} color="var(--danger-color)" />
                I GOT TAGGED
              </button>
            )}
          </div>
        )}

        {/* Caught / Spectator Notice */}
        {!isAlive && (
          <div className="cut-border-danger">
            <div style={{
              background: '#1A0B1E',
              padding: '12px 16px',
              textAlign: 'center'
            }} className="cut">
              <div style={{ fontWeight: 800, color: 'var(--danger-color)', fontSize: '14px' }}>
                💀 YOU WERE ELIMINATED
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                You are now spectating. Keep an eye on your surviving teammates!
              </div>
            </div>
          </div>
        )}

        {/* Mission Combat Feed Ticker */}
        {feedMessages.length > 0 && (
          <div style={{
            background: 'rgba(11, 9, 20, 0.92)',
            border: '1px solid var(--line)',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis'
          }} className="cut-sm">
            <span style={{ color: 'var(--p-300)', fontWeight: 700 }}>FEED:</span>
            <span>{feedMessages[feedMessages.length - 1]?.text}</span>
          </div>
        )}
      </div>

      {/* Runner "I Got Tagged" Confirmation Modal */}
      {confirmTagModal && (
        <div className="modal-overlay" style={{ pointerEvents: 'auto' }}>
          <div className="modal-content cut">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={32} color="var(--danger-color)" />
              <div>
                <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '20px' }}>
                  Confirm Tagged?
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Were you caught by a gateboy? This is permanent for this match!
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setConfirmTagModal(false)}
                className="btn btn-ghost cut"
                style={{ flex: 1 }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setConfirmTagModal(false);
                  onSelfTag();
                }}
                className="btn btn-danger cut"
                style={{ flex: 1 }}
              >
                YES, I'M CAUGHT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

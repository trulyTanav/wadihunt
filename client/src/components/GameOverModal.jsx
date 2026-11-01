import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Clock, Target, RotateCcw, Award } from 'lucide-react';
import { sound } from '../audio/soundFX';
import AvatarBadge from './AvatarBadge';

export default function GameOverModal({ roomState, currentPlayer, onResetToLobby }) {
  const winner = roomState?.winner; // 'HUNTERS' | 'SHADOWS'
  const isHost = currentPlayer?.isHost;
  const isHuntersWin = winner === 'HUNTERS';

  useEffect(() => {
    sound.playVictory();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: isHuntersWin ? ['#FF2A55', '#7C4DFF', '#ffffff'] : ['#00F5D4', '#7C4DFF', '#ffffff']
    });
  }, [winner]);

  const hunters = (roomState?.players || []).filter(p => p.role === 'HUNTER');
  const shadows = (roomState?.players || []).filter(p => p.role === 'SHADOW');

  // MVP Hunter (most tags)
  const mvpHunter = [...hunters].sort((a, b) => (b.tagsCount || 0) - (a.tagsCount || 0))[0];

  return (
    <div className="modal-overlay">
      <div className="modal-content cut" style={{ maxWidth: '440px', textAlign: 'center' }}>
        {/* Victory Trophy */}
        <div style={{
          alignSelf: 'center',
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: isHuntersWin ? 'rgba(255, 42, 85, 0.18)' : 'rgba(0, 245, 212, 0.18)',
          border: `2px solid ${isHuntersWin ? 'var(--hunter-color)' : 'var(--runner-color)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 24px ${isHuntersWin ? 'var(--hunter-color)' : 'var(--runner-color)'}`
        }}>
          <Trophy size={36} color={isHuntersWin ? 'var(--hunter-color)' : 'var(--runner-color)'} />
        </div>

        <div>
          <h2 style={{
            fontFamily: 'var(--font-head)',
            fontSize: '28px',
            fontWeight: 800,
            color: isHuntersWin ? 'var(--hunter-color)' : 'var(--runner-color)',
            textTransform: 'uppercase'
          }}>
            {isHuntersWin ? 'GATEBOYS WIN!' : 'RUNNERS WIN!'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            {isHuntersWin ? 'All runners were tracked down and eliminated.' : 'Surviving runners outlasted the clock!'}
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          margin: '12px 0'
        }}>
          <div style={{ background: 'var(--black)', padding: '12px', border: '1px solid var(--line)' }} className="cut-sm">
            <Clock size={16} color="var(--p-300)" />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>TOTAL TIME</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700 }}>
              {Math.floor((roomState?.elapsedSeconds || 0) / 60)}m {((roomState?.elapsedSeconds || 0) % 60)}s
            </div>
          </div>

          <div style={{ background: 'var(--black)', padding: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="cut-sm">
            <Award size={16} color="var(--hunter-color)" />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>MVP GATEBOY</div>
            {mvpHunter ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <AvatarBadge avatar={mvpHunter.avatar} name={mvpHunter.name} role="HUNTER" size={20} border={true} />
                <span style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mvpHunter.name} ({mvpHunter.tagsCount || 0})
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '13px', fontWeight: 700 }}>None</div>
            )}
          </div>
        </div>

        {/* Player recap list */}
        <div style={{ maxHeight: '160px', overflowY: 'auto', textAlign: 'left', background: 'var(--black)', padding: '10px', border: '1px solid var(--line)' }} className="cut-sm">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
            ROSTER BREAKDOWN:
          </div>
          {roomState?.players?.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AvatarBadge avatar={p.avatar} name={p.name} role={p.role} size={20} border={false} />
                <span>{p.name} ({p.role === 'HUNTER' ? 'GATEBOY' : 'RUNNER'})</span>
              </span>
              <span style={{ color: p.role === 'HUNTER' ? 'var(--hunter-color)' : p.status === 'ALIVE' ? 'var(--runner-color)' : 'var(--danger-color)' }}>
                {p.role === 'HUNTER' ? `${p.tagsCount || 0} Tags` : p.status}
              </span>
            </div>
          ))}
        </div>

        {/* Action Button */}
        {isHost ? (
          <button
            onClick={onResetToLobby}
            className="btn btn-primary cut-lg"
            style={{ width: '100%', minHeight: '50px' }}
          >
            <RotateCcw size={18} />
            RETURN TO LOBBY / REMATCH
          </button>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Waiting for host to return to lobby...
          </div>
        )}
      </div>
    </div>
  );
}

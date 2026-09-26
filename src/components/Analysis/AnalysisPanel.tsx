import React from 'react';
import { MoveRecord, GameStatus } from '../../types/chess';
import { AlertTriangle, AlertCircle, HelpCircle, ChevronRight, RefreshCw, Trophy, CheckCircle2 } from 'lucide-react';

interface AnalysisPanelProps {
  status: GameStatus;
  moves: MoveRecord[];
  currentMoveIndex: number;
  onSelectMove: (index: number) => void;
  onRematch?: () => void;
}

export function formatEngineMove(uci?: string): string {
  if (!uci) return '';
  if (uci.length >= 4) {
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promo = uci.length > 4 ? `=${uci[4].toUpperCase()}` : '';
    return `${from} → ${to}${promo}`;
  }
  return uci;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  status,
  moves,
  currentMoveIndex,
  onSelectMove,
  onRematch
}) => {
  const flaggedMoves = moves
    .map((m, idx) => ({ ...m, index: idx }))
    .filter((m) => m.blunderTag && m.blunderTag !== 'good' && m.blunderTag !== 'best');

  let title = 'Game Drawn';
  let bannerClass = 'banner-draw';
  if (status.winner === 'w') {
    title = 'White Won';
    bannerClass = 'banner-win';
  } else if (status.winner === 'b') {
    title = 'Black Won';
    bannerClass = 'banner-loss';
  }

  const getReasonText = (reason: GameStatus['reason']) => {
    switch (reason) {
      case 'checkmate':
        return 'by Checkmate';
      case 'stalemate':
        return 'by Stalemate';
      case 'threefold_repetition':
        return 'by Threefold Repetition';
      case 'fifty_moves':
        return 'by 50-Move Rule';
      case 'insufficient_material':
        return 'by Insufficient Material';
      case 'resignation':
        return 'by Resignation';
      case 'draw_agreement':
        return 'by Draw Agreement';
      case 'timeout':
        return 'on Time';
      default:
        return '';
    }
  };

  return (
    <div className="analysis-panel">
      {/* End game banner */}
      {status.isOver && (
        <div className={`analysis-gameover-banner ${bannerClass}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy className="w-4 h-4" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{title}</div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>{getReasonText(status.reason)}</div>
            </div>
          </div>
          {onRematch && (
            <button onClick={onRematch} className="btn-rematch cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              <span>Rematch</span>
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="analysis-header">
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#f1f5f9' }}>
          Key Moments & Mistakes ({flaggedMoves.length})
        </span>
      </div>

      {/* List of blunders/mistakes/inaccuracies */}
      <div className="analysis-list">
        {flaggedMoves.length === 0 ? (
          <div className="analysis-empty">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span>
              {moves.length < 2
                ? 'Play some moves to see live blunder detection.'
                : 'No significant blunders detected! Solid game.'}
            </span>
          </div>
        ) : (
          flaggedMoves.map((m) => {
            const moveNum = Math.floor(m.index / 2) + 1;
            const turnLabel = m.color === 'w' ? `${moveNum}.` : `${moveNum}...`;
            const isSelected = currentMoveIndex === m.index;

            let tagClass = 'tag-inaccuracy';
            let icon = <HelpCircle className="w-4 h-4 text-amber-400" />;
            if (m.blunderTag === 'blunder') {
              tagClass = 'tag-blunder';
              icon = <AlertTriangle className="w-4 h-4 text-rose-500" />;
            } else if (m.blunderTag === 'mistake') {
              tagClass = 'tag-mistake';
              icon = <AlertCircle className="w-4 h-4 text-orange-400" />;
            }

            return (
              <div
                key={m.index}
                onClick={() => onSelectMove(m.index)}
                className={`analysis-card ${tagClass} ${isSelected ? 'selected' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ marginTop: '2px' }}>{icon}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="analysis-movenum">{turnLabel}</span>
                      <span className="analysis-movename">{m.san}</span>
                      <span className={`analysis-badge ${tagClass}`}>{m.blunderTag}</span>
                    </div>

                    {m.engineBestMove && (
                      <div className="analysis-suggestion">
                        <span>Engine suggestion: </span>
                        <strong style={{ color: '#4ade80' }}>
                          {formatEngineMove(m.engineBestMove)}
                        </strong>
                        {m.centipawnLoss && m.centipawnLoss > 0 && (
                          <span style={{ color: '#f87171', marginLeft: '4px' }}>
                            (-{(m.centipawnLoss / 100).toFixed(1)} pawns)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

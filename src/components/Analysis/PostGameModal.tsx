import React from 'react';
import { MoveRecord, GameStatus } from '../../types/chess';
import { AlertTriangle, AlertCircle, HelpCircle, CheckCircle, ChevronRight, X, Trophy } from 'lucide-react';

interface PostGameModalProps {
  status: GameStatus;
  moves: MoveRecord[];
  onSelectMove: (index: number) => void;
  onClose: () => void;
  onNewGame: () => void;
}

export const PostGameModal: React.FC<PostGameModalProps> = ({
  status,
  moves,
  onSelectMove,
  onClose,
  onNewGame
}) => {
  // Analyze player blunders
  const flaggedMoves = moves
    .map((m, idx) => ({ ...m, index: idx }))
    .filter((m) => m.blunderTag && m.blunderTag !== 'good' && m.blunderTag !== 'best');

  let title = 'Game Drawn';
  let bannerColor = 'bg-amber-600/20 text-amber-300 border-amber-500/30';
  if (status.winner === 'w') {
    title = 'White Won!';
    bannerColor = 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30';
  } else if (status.winner === 'b') {
    title = 'Black Won!';
    bannerColor = 'bg-rose-600/20 text-rose-300 border-rose-500/30';
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
        return 'by Mutual Draw Agreement';
      case 'timeout':
        return 'on Time';
      default:
        return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Trophy className="w-5 h-5" style={{ color: '#fbbf24' }} />
            <span>Game Analysis & Review</span>
          </div>
          <button onClick={onClose} className="close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Winner Banner */}
        <div className={`analysis-gameover-banner ${status.winner === 'w' ? 'banner-win' : status.winner === 'b' ? 'banner-loss' : 'banner-draw'}`}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{title}</div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>{getReasonText(status.reason)}</div>
          </div>
          <button
            onClick={() => {
              onClose();
              onNewGame();
            }}
            className="btn-rematch cursor-pointer"
          >
            Rematch
          </button>
        </div>

        {/* Blunder Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="analysis-header">
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#f1f5f9' }}>
              Key Moments & Mistakes ({flaggedMoves.length})
            </span>
          </div>

          {flaggedMoves.length === 0 ? (
            <div className="analysis-empty">
              <span>Clean game! No significant blunders detected.</span>
            </div>
          ) : (
            <div className="analysis-list" style={{ maxHeight: '280px' }}>
              {flaggedMoves.map((m) => {
                const moveNum = Math.floor(m.index / 2) + 1;
                const turnLabel = m.color === 'w' ? `${moveNum}.` : `${moveNum}...`;

                let tagClass = 'tag-inaccuracy';
                let icon = <HelpCircle className="w-4 h-4" style={{ color: '#fbbf24' }} />;
                if (m.blunderTag === 'blunder') {
                  tagClass = 'tag-blunder';
                  icon = <AlertTriangle className="w-4 h-4" style={{ color: '#f87171' }} />;
                } else if (m.blunderTag === 'mistake') {
                  tagClass = 'tag-mistake';
                  icon = <AlertCircle className="w-4 h-4" style={{ color: '#fb923c' }} />;
                }

                return (
                  <div
                    key={m.index}
                    onClick={() => {
                      onSelectMove(m.index);
                      onClose();
                    }}
                    className={`analysis-card ${tagClass}`}
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
                              {m.engineBestMove}
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
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid #383530' }}>
          <button
            onClick={onClose}
            className="btn-action btn-primary"
            style={{ flex: 'initial', padding: '6px 20px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

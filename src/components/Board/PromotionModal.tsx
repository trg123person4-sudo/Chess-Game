import React from 'react';
import { PieceColor, PieceType } from '../../types/chess';
import { PieceIcon } from './PieceIcons';

interface PromotionModalProps {
  color: PieceColor;
  onSelect: (piece: PieceType) => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  color,
  onSelect,
  onCancel
}) => {
  const pieces: PieceType[] = ['q', 'r', 'b', 'n'];

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="promotion-dialog" onClick={(e) => e.stopPropagation()} style={{ minWidth: 280 }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>
          Promote Pawn
        </h3>
        <div className="promotion-pieces-row">
          {pieces.map((p) => (
            <button
              key={p}
              onClick={() => onSelect(p)}
              className="promotion-btn"
              title={`Promote to ${p.toUpperCase()}`}
            >
              <PieceIcon type={p} color={color} size={48} />
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="btn-action"
          style={{ flex: 'initial', padding: '5px 16px', marginTop: '4px', fontSize: '11px' }}
        >
          Cancel Move
        </button>
      </div>
    </div>
  );
};

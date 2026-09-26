import React from 'react';
import { ChessPiece, Square as ChessSquare } from '../../types/chess';
import { PieceIcon, PieceSetType } from './PieceIcons';

interface SquareProps {
  square: ChessSquare;
  piece: ChessPiece | null;
  isLight: boolean;
  isSelected: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  isLegalMove: boolean;
  isLegalCapture: boolean;
  showFileCoord: boolean;
  showRankCoord: boolean;
  pieceSet?: PieceSetType;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const Square: React.FC<SquareProps> = ({
  square,
  piece,
  isLight,
  isSelected,
  isLastMove,
  isCheck,
  isLegalMove,
  isLegalCapture,
  showFileCoord,
  showRankCoord,
  pieceSet = 'cburnett',
  onClick,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const file = square[0];
  const rank = square[1];

  let classes = `chess-square ${isLight ? 'square-light' : 'square-dark'}`;
  if (isSelected) classes += ' square-highlight-selected';
  else if (isLastMove) classes += ' square-highlight-lastmove';

  if (isCheck) classes += ' square-in-check';
  if (isLegalCapture) classes += ' square-capture-target';

  return (
    <div
      data-square={square}
      className={classes}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Coordinates */}
      {showRankCoord && <span className="square-coord-rank">{rank}</span>}
      {showFileCoord && <span className="square-coord-file">{file}</span>}

      {/* Piece - Centered and filling square with consistent padding */}
      {piece && (
        <div
          draggable
          onDragStart={onDragStart}
          className="piece-container"
        >
          <PieceIcon type={piece.type} color={piece.color} set={pieceSet} />
        </div>
      )}

      {/* Legal Move Indicators */}
      {isLegalMove && !piece && <div className="legal-dot" />}
      {isLegalCapture && <div className="legal-capture-ring" />}
    </div>
  );
};

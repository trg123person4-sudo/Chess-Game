import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { ChessPiece, PieceColor, PieceType, Square as ChessSquare } from '../../types/chess';
import { Square } from './Square';
import { PromotionModal } from './PromotionModal';
import { PieceSetType } from './PieceIcons';
import { Check, X } from 'lucide-react';

interface ChessBoardProps {
  game: Chess;
  orientation?: PieceColor;
  lastMove?: { from: string; to: string } | null;
  disabled?: boolean;
  showCoordinates?: boolean;
  showLegalDots?: boolean;
  autoQueen?: boolean;
  confirmMove?: boolean;
  pieceSet?: PieceSetType;
  onMove: (from: string, to: string, promotion?: PieceType) => boolean;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  game,
  orientation = 'w',
  lastMove = null,
  disabled = false,
  showCoordinates = true,
  showLegalDots = true,
  autoQueen = false,
  confirmMove = false,
  pieceSet = 'cburnett',
  onMove
}) => {
  const [selectedSquare, setSelectedSquare] = useState<ChessSquare | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [stagedMove, setStagedMove] = useState<{ from: string; to: string; promotion?: PieceType } | null>(null);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = orientation === 'w' ? files : [...files].reverse();
  const displayRanks = orientation === 'w' ? ranks : [...ranks].reverse();

  // Find King in check
  let checkSquare: string | null = null;
  if (game.inCheck()) {
    const turn = game.turn();
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          const colName = String.fromCharCode('a'.charCodeAt(0) + c);
          const rankNum = 8 - r;
          checkSquare = `${colName}${rankNum}`;
          break;
        }
      }
      if (checkSquare) break;
    }
  }

  // Calculate legal moves from selected square
  const legalMovesFromSelected = selectedSquare
    ? game.moves({ square: selectedSquare, verbose: true })
    : [];

  const legalDestinationMap = new Map<string, { isCapture: boolean; isPromotion: boolean }>();
  for (const m of legalMovesFromSelected) {
    legalDestinationMap.set(m.to, {
      isCapture: !!m.captured,
      isPromotion: !!m.promotion
    });
  }

  const commitMove = (from: string, to: string, promotion?: PieceType) => {
    if (confirmMove) {
      setStagedMove({ from, to, promotion });
      return;
    }
    const success = onMove(from, to, promotion);
    if (success) {
      setSelectedSquare(null);
      setStagedMove(null);
    }
  };

  const handleConfirmStagedMove = () => {
    if (!stagedMove) return;
    const success = onMove(stagedMove.from, stagedMove.to, stagedMove.promotion);
    if (success) {
      setSelectedSquare(null);
      setStagedMove(null);
    }
  };

  const handleCancelStagedMove = () => {
    setStagedMove(null);
    setSelectedSquare(null);
  };

  const handleSquareClick = (square: ChessSquare) => {
    if (disabled) return;
    if (stagedMove) return; // Wait for confirm or cancel

    if (!selectedSquare) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const targetPiece = game.get(square);
    if (targetPiece && targetPiece.color === game.turn()) {
      setSelectedSquare(square);
      return;
    }

    executeMoveOrPromptPromotion(selectedSquare, square);
  };

  const executeMoveOrPromptPromotion = (from: string, to: string) => {
    const moveInfo = legalDestinationMap.get(to);
    if (!moveInfo) {
      setSelectedSquare(null);
      return;
    }

    if (moveInfo.isPromotion) {
      if (autoQueen) {
        commitMove(from, to, 'q');
        return;
      }
      setPendingPromotion({ from, to });
      return;
    }

    commitMove(from, to);
  };

  const handlePromotionSelect = (piece: PieceType) => {
    if (!pendingPromotion) return;
    commitMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  const handleDragStart = (square: ChessSquare, e: React.DragEvent) => {
    if (disabled || stagedMove) return;
    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) {
      e.preventDefault();
      return;
    }
    setSelectedSquare(square);
    e.dataTransfer.setData('text/plain', square);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetSquare: ChessSquare, e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || stagedMove) return;
    const sourceSquare = e.dataTransfer.getData('text/plain');
    if (!sourceSquare) return;

    const moves = game.moves({ square: sourceSquare as any, verbose: true });
    const targetMove = moves.find((m) => m.to === targetSquare);

    if (targetMove) {
      if (targetMove.promotion) {
        if (autoQueen) {
          commitMove(sourceSquare, targetSquare, 'q');
        } else {
          setPendingPromotion({ from: sourceSquare, to: targetSquare });
        }
      } else {
        commitMove(sourceSquare, targetSquare);
      }
    } else {
      setSelectedSquare(null);
    }
  };

  return (
    <div className="chess-board-card">
      <div className="chess-grid">
        {displayRanks.map((rank) =>
          displayFiles.map((file) => {
            const square = `${file}${rank}` as ChessSquare;
            const piece = game.get(square) as ChessPiece | null;
            const fileNum = file.charCodeAt(0) - 'a'.charCodeAt(0);
            const rankNum = parseInt(rank, 10);
            const isLight = (fileNum + rankNum) % 2 !== 0;

            const isSelected = selectedSquare === square || stagedMove?.from === square;
            const isLastMoveSquare =
              (!stagedMove && !!lastMove && (lastMove.from === square || lastMove.to === square)) ||
              stagedMove?.to === square;
            const isKingInCheck = checkSquare === square;

            const legalMove = legalDestinationMap.get(square);
            const isLegalMove = showLegalDots && !!legalMove;
            const isLegalCapture = showLegalDots && isLegalMove && (legalMove.isCapture || !!piece);

            const showRankCoord = showCoordinates && (orientation === 'w' ? file === 'a' : file === 'h');
            const showFileCoord = showCoordinates && (orientation === 'w' ? rank === '1' : rank === '8');

            return (
              <Square
                key={square}
                square={square}
                piece={piece}
                isLight={isLight}
                isSelected={isSelected}
                isLastMove={isLastMoveSquare}
                isCheck={isKingInCheck}
                isLegalMove={isLegalMove}
                isLegalCapture={isLegalCapture}
                showFileCoord={showFileCoord}
                showRankCoord={showRankCoord}
                pieceSet={pieceSet}
                onClick={() => handleSquareClick(square)}
                onDragStart={(e) => handleDragStart(square, e)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(square, e)}
              />
            );
          })
        )}
      </div>

      {/* Move Confirmation Floating Pill */}
      {stagedMove && (
        <div className="move-confirm-overlay">
          <div className="move-confirm-pill">
            <span className="move-confirm-text">
              Confirm move: <strong>{stagedMove.from}-{stagedMove.to}</strong>
              {stagedMove.promotion ? `=${stagedMove.promotion.toUpperCase()}` : ''}?
            </span>
            <div className="move-confirm-actions">
              <button
                type="button"
                onClick={handleConfirmStagedMove}
                className="confirm-btn-yes"
                title="Confirm move"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Submit</span>
              </button>
              <button
                type="button"
                onClick={handleCancelStagedMove}
                className="confirm-btn-no"
                title="Cancel move"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <PromotionModal
          color={game.turn()}
          onSelect={handlePromotionSelect}
          onCancel={() => {
            setPendingPromotion(null);
            setSelectedSquare(null);
          }}
        />
      )}
    </div>
  );
};

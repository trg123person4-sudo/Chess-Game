import { Position, Move, CastlingRights } from './types';
import { squareToCoords, coordsToSquare, SQ } from './constants';

export function applyMove(pos: Position, move: Move): Position {
  const newBoard = [...pos.board];
  const movingPiece = newBoard[move.from];

  if (!movingPiece) {
    throw new Error(`No piece at from square ${move.from}`);
  }

  const { file: fromFile, rank: fromRank } = squareToCoords(move.from);
  const { file: toFile, rank: toRank } = squareToCoords(move.to);

  // 1. Castling Rights update
  const newCastling: CastlingRights = { ...pos.castling };

  // King moves
  if (movingPiece.type === 'k') {
    if (movingPiece.color === 'w') {
      newCastling.wK = false;
      newCastling.wQ = false;
    } else {
      newCastling.bK = false;
      newCastling.bQ = false;
    }
  }

  // Rook moves
  if (movingPiece.type === 'r') {
    if (move.from === SQ.A1) newCastling.wQ = false;
    else if (move.from === SQ.H1) newCastling.wK = false;
    else if (move.from === SQ.A8) newCastling.bQ = false;
    else if (move.from === SQ.H8) newCastling.bK = false;
  }

  // Rook captures
  if (move.to === SQ.A1) newCastling.wQ = false;
  else if (move.to === SQ.H1) newCastling.wK = false;
  else if (move.to === SQ.A8) newCastling.bQ = false;
  else if (move.to === SQ.H8) newCastling.bK = false;

  // 2. Handle En Passant Target Square
  let nextEnPassantSquare: number | null = null;
  if (movingPiece.type === 'p' && Math.abs(toRank - fromRank) === 2) {
    const skippedRank = (fromRank + toRank) / 2;
    nextEnPassantSquare = coordsToSquare(fromFile, skippedRank);
  }

  // 3. Move Execution
  if (move.isCastling) {
    // King move
    newBoard[move.to] = movingPiece;
    newBoard[move.from] = null;

    // Rook move
    if (move.to === SQ.G1) {
      // White kingside
      newBoard[SQ.F1] = newBoard[SQ.H1];
      newBoard[SQ.H1] = null;
    } else if (move.to === SQ.C1) {
      // White queenside
      newBoard[SQ.D1] = newBoard[SQ.A1];
      newBoard[SQ.A1] = null;
    } else if (move.to === SQ.G8) {
      // Black kingside
      newBoard[SQ.F8] = newBoard[SQ.H8];
      newBoard[SQ.H8] = null;
    } else if (move.to === SQ.C8) {
      // Black queenside
      newBoard[SQ.D8] = newBoard[SQ.A8];
      newBoard[SQ.A8] = null;
    }
  } else if (move.isEnPassant) {
    // Pawn moves to en passant target square
    newBoard[move.to] = movingPiece;
    newBoard[move.from] = null;

    // Remove the captured pawn (same file as target, but starting rank of capturing pawn)
    const capturedPawnSq = coordsToSquare(toFile, fromRank);
    newBoard[capturedPawnSq] = null;
  } else if (move.promotion) {
    // Pawn promotes
    newBoard[move.to] = {
      type: move.promotion,
      color: movingPiece.color
    };
    newBoard[move.from] = null;
  } else {
    // Standard move or standard capture
    newBoard[move.to] = movingPiece;
    newBoard[move.from] = null;
  }

  // 4. Clocks update
  const isPawnMove = movingPiece.type === 'p';
  const isCapture = !!move.captured || move.isEnPassant;
  const newHalfmoveClock = isPawnMove || isCapture ? 0 : pos.halfmoveClock + 1;
  const newFullmoveNumber = pos.turn === 'b' ? pos.fullmoveNumber + 1 : pos.fullmoveNumber;
  const nextTurn = pos.turn === 'w' ? 'b' : 'w';

  return {
    board: newBoard,
    turn: nextTurn,
    castling: newCastling,
    enPassantSquare: nextEnPassantSquare,
    halfmoveClock: newHalfmoveClock,
    fullmoveNumber: newFullmoveNumber
  };
}

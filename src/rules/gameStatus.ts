import { Position, Color, GameStatus, Piece } from './types';
import { isSquareAttacked } from './attacks';
import { generateLegalMoves } from './moveGen';
import { squareToCoords } from './constants';

export function isCheck(pos: Position, color?: Color): boolean {
  const checkColor = color || pos.turn;
  const oppColor: Color = checkColor === 'w' ? 'b' : 'w';

  let kingSq = -1;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p && p.color === checkColor && p.type === 'k') {
      kingSq = sq;
      break;
    }
  }

  if (kingSq === -1) return false;
  return isSquareAttacked(pos, kingSq, oppColor);
}

export function isCheckmate(pos: Position): boolean {
  if (!isCheck(pos)) return false;
  const legalMoves = generateLegalMoves(pos);
  return legalMoves.length === 0;
}

export function isStalemate(pos: Position): boolean {
  if (isCheck(pos)) return false;
  const legalMoves = generateLegalMoves(pos);
  return legalMoves.length === 0;
}

export function isFiftyMoveRule(pos: Position): boolean {
  return pos.halfmoveClock >= 100;
}

export function isInsufficientMaterial(pos: Position): boolean {
  const pieces: { piece: Piece; sq: number }[] = [];

  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p) {
      // Pawns, rooks, queens have mating material
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') {
        return false;
      }
      pieces.push({ piece: p, sq });
    }
  }

  // 1. King vs King
  if (pieces.length === 2) {
    return true;
  }

  // 2. King & minor piece vs King
  if (pieces.length === 3) {
    const nonKings = pieces.filter((x) => x.piece.type !== 'k');
    if (nonKings.length === 1) {
      const minor = nonKings[0].piece.type;
      if (minor === 'b' || minor === 'n') {
        return true;
      }
    }
  }

  // 3. King & Bishop vs King & Bishop (same color square bishops)
  if (pieces.length === 4) {
    const whiteBishops = pieces.filter((x) => x.piece.color === 'w' && x.piece.type === 'b');
    const blackBishops = pieces.filter((x) => x.piece.color === 'b' && x.piece.type === 'b');

    if (whiteBishops.length === 1 && blackBishops.length === 1) {
      const wbCoords = squareToCoords(whiteBishops[0].sq);
      const bbCoords = squareToCoords(blackBishops[0].sq);
      const wbIsLight = (wbCoords.file + wbCoords.rank) % 2 !== 0;
      const bbIsLight = (bbCoords.file + bbCoords.rank) % 2 !== 0;

      // Same color square bishops cannot mate
      if (wbIsLight === bbIsLight) {
        return true;
      }
    }
  }

  return false;
}

export function isThreefoldRepetition(positionHistory: string[]): boolean {
  if (positionHistory.length < 3) return false;

  const counts = new Map<string, number>();
  for (const fen of positionHistory) {
    // Normalizing FEN to only piece placement, active turn, castling rights, and en passant square
    const parts = fen.trim().split(/\s+/);
    if (parts.length >= 4) {
      const key = `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
      const c = (counts.get(key) || 0) + 1;
      if (c >= 3) return true;
      counts.set(key, c);
    }
  }

  return false;
}

export function getGameStatus(pos: Position, positionHistory: string[] = []): GameStatus {
  const inCheck = isCheck(pos);
  const legalMoves = generateLegalMoves(pos);

  if (legalMoves.length === 0) {
    if (inCheck) {
      return {
        isOver: true,
        winner: pos.turn === 'w' ? 'b' : 'w',
        reason: 'checkmate',
        inCheck: true
      };
    } else {
      return {
        isOver: true,
        winner: 'draw',
        reason: 'stalemate',
        inCheck: false
      };
    }
  }

  if (isInsufficientMaterial(pos)) {
    return {
      isOver: true,
      winner: 'draw',
      reason: 'insufficient_material',
      inCheck
    };
  }

  if (isFiftyMoveRule(pos)) {
    return {
      isOver: true,
      winner: 'draw',
      reason: 'fifty_moves',
      inCheck
    };
  }

  if (isThreefoldRepetition(positionHistory)) {
    return {
      isOver: true,
      winner: 'draw',
      reason: 'threefold_repetition',
      inCheck
    };
  }

  return {
    isOver: false,
    winner: null,
    reason: null,
    inCheck
  };
}

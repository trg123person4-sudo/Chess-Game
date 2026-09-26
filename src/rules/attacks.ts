import { Position, Color } from './types';
import { squareToCoords, coordsToSquare } from './constants';

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

const ORTHOGONAL_DIRS = [
  [0, 1], [0, -1], [1, 0], [-1, 0]
];

const DIAGONAL_DIRS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

export function isSquareAttacked(pos: Position, targetSq: number, byColor: Color): boolean {
  if (targetSq < 0 || targetSq >= 64) return false;
  const { file: tFile, rank: tRank } = squareToCoords(targetSq);

  // 1. Pawn attacks
  const pawnRankOffset = byColor === 'w' ? -1 : 1;
  const attackerRank = tRank + pawnRankOffset;
  if (attackerRank >= 0 && attackerRank < 8) {
    for (const fileOffset of [-1, 1]) {
      const attackerFile = tFile + fileOffset;
      if (attackerFile >= 0 && attackerFile < 8) {
        const sq = coordsToSquare(attackerFile, attackerRank);
        const p = pos.board[sq];
        if (p && p.color === byColor && p.type === 'p') {
          return true;
        }
      }
    }
  }

  // 2. Knight attacks
  for (const [df, dr] of KNIGHT_OFFSETS) {
    const f = tFile + df;
    const r = tRank + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = pos.board[coordsToSquare(f, r)];
      if (p && p.color === byColor && p.type === 'n') {
        return true;
      }
    }
  }

  // 3. King attacks (adjacent squares)
  for (const [df, dr] of KING_OFFSETS) {
    const f = tFile + df;
    const r = tRank + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = pos.board[coordsToSquare(f, r)];
      if (p && p.color === byColor && p.type === 'k') {
        return true;
      }
    }
  }

  // 4. Orthogonal sliders (Rook & Queen)
  for (const [df, dr] of ORTHOGONAL_DIRS) {
    let f = tFile + df;
    let r = tRank + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = pos.board[coordsToSquare(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) {
          return true;
        }
        break; // blocked by any piece
      }
      f += df;
      r += dr;
    }
  }

  // 5. Diagonal sliders (Bishop & Queen)
  for (const [df, dr] of DIAGONAL_DIRS) {
    let f = tFile + df;
    let r = tRank + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const p = pos.board[coordsToSquare(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) {
          return true;
        }
        break; // blocked by any piece
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

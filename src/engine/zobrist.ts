import { Chess } from 'chess.js';

// Deterministic PRNG for reproducibility
class PRNG {
  private state: bigint;
  constructor(seed = 1070372n) {
    this.state = seed;
  }
  next64(): bigint {
    this.state ^= this.state >> 12n;
    this.state ^= (this.state << 25n) & 0xffffffffffffffffn;
    this.state ^= this.state >> 27n;
    return (this.state * 2685821657736338717n) & 0xffffffffffffffffn;
  }
}

const prng = new PRNG();

// 64 squares x 12 piece types: wP, wN, wB, wR, wQ, wK, bP, bN, bB, bR, bQ, bK
export const ZOBRIST_PIECES: Record<string, bigint[]> = {
  p: Array.from({ length: 64 }, () => prng.next64()),
  n: Array.from({ length: 64 }, () => prng.next64()),
  b: Array.from({ length: 64 }, () => prng.next64()),
  r: Array.from({ length: 64 }, () => prng.next64()),
  q: Array.from({ length: 64 }, () => prng.next64()),
  k: Array.from({ length: 64 }, () => prng.next64()),
  P: Array.from({ length: 64 }, () => prng.next64()),
  N: Array.from({ length: 64 }, () => prng.next64()),
  B: Array.from({ length: 64 }, () => prng.next64()),
  R: Array.from({ length: 64 }, () => prng.next64()),
  Q: Array.from({ length: 64 }, () => prng.next64()),
  K: Array.from({ length: 64 }, () => prng.next64())
};

export const ZOBRIST_SIDE_TO_MOVE = prng.next64();
export const ZOBRIST_CASTLING: Record<string, bigint> = {
  K: prng.next64(),
  Q: prng.next64(),
  k: prng.next64(),
  q: prng.next64()
};
export const ZOBRIST_EP_FILE = Array.from({ length: 8 }, () => prng.next64());

export function computeZobristHash(chess: Chess): bigint {
  let hash = 0n;
  const board = chess.board();

  // Pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const sq = r * 8 + c;
        const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
        hash ^= ZOBRIST_PIECES[key][sq];
      }
    }
  }

  // Side to move (hash if black)
  if (chess.turn() === 'b') {
    hash ^= ZOBRIST_SIDE_TO_MOVE;
  }

  // Castling rights
  // Note: in chess.js, getCastlingRights is available in v1 beta or can be parsed from fen
  const fenParts = chess.fen().split(' ');
  const castlingStr = fenParts[2] || '-';
  for (const char of castlingStr) {
    if (ZOBRIST_CASTLING[char]) {
      hash ^= ZOBRIST_CASTLING[char];
    }
  }

  // En passant
  const epSquare = fenParts[3];
  if (epSquare && epSquare !== '-') {
    const epFile = epSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    if (epFile >= 0 && epFile < 8) {
      hash ^= ZOBRIST_EP_FILE[epFile];
    }
  }

  return hash;
}

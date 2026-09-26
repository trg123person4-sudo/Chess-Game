export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface CastlingRights {
  wK: boolean; // White kingside (O-O)
  wQ: boolean; // White queenside (O-O-O)
  bK: boolean; // Black kingside (O-O)
  bQ: boolean; // Black queenside (O-O-O)
}

export interface Move {
  from: number; // 0..63
  to: number;   // 0..63
  piece: PieceType;
  color: Color;
  captured?: PieceType;
  promotion?: PieceType; // 'q' | 'r' | 'b' | 'n'
  isCastling?: boolean;
  isEnPassant?: boolean;
  san?: string;
}

export interface Position {
  board: (Piece | null)[]; // 64 squares: 0 = a1, 7 = h1, 56 = a8, 63 = h8
  turn: Color;
  castling: CastlingRights;
  enPassantSquare: number | null; // target square (0..63) where capturing pawn lands, or null
  halfmoveClock: number; // for 50-move rule
  fullmoveNumber: number;
}

export type TerminationReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold_repetition'
  | 'fifty_moves'
  | 'insufficient_material'
  | 'resignation'
  | 'draw_agreement'
  | 'timeout'
  | 'aborted'
  | null;

export interface GameStatus {
  isOver: boolean;
  winner: Color | 'draw' | null;
  reason: TerminationReason;
  inCheck: boolean;
}

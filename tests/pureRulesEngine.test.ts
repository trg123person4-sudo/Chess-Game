import { describe, it, expect } from 'vitest';
import {
  parseFEN,
  toFEN,
  generateLegalMoves,
  applyMove,
  isCheck,
  isCheckmate,
  isStalemate,
  isFiftyMoveRule,
  isInsufficientMaterial,
  isThreefoldRepetition,
  getGameStatus,
  moveToSAN,
  generatePGN,
  STARTING_FEN,
  algebraicToSquare,
  SQ
} from '../src/rules';

describe('Standalone Pure-Function Chess Rules Engine', () => {
  describe('Starting Position and Move Generation', () => {
    it('generates exactly 20 legal moves from starting position', () => {
      const pos = parseFEN(STARTING_FEN);
      const moves = generateLegalMoves(pos);

      // 16 pawn moves (8 single pushes + 8 double pushes) + 4 knight moves
      expect(moves.length).toBe(20);
      expect(pos.turn).toBe('w');
      expect(isCheck(pos)).toBe(false);
      expect(isCheckmate(pos)).toBe(false);
      expect(isStalemate(pos)).toBe(false);
    });

    it('round-trips STARTING_FEN through parseFEN and toFEN', () => {
      const pos = parseFEN(STARTING_FEN);
      const output = toFEN(pos);
      expect(output).toBe(STARTING_FEN);
    });
  });

  describe('Castling Legality Conditions', () => {
    it('allows both kingside and queenside castling when empty and unattacked', () => {
      // Both White castling options open
      const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const kingside = moves.find((m) => m.isCastling && m.to === SQ.G1);
      const queenside = moves.find((m) => m.isCastling && m.to === SQ.C1);

      expect(kingside).toBeDefined();
      expect(queenside).toBeDefined();

      // Execute kingside castling
      const nextPos = applyMove(pos, kingside!);
      expect(nextPos.board[SQ.G1]?.type).toBe('k');
      expect(nextPos.board[SQ.F1]?.type).toBe('r');
      expect(nextPos.board[SQ.E1]).toBeNull();
      expect(nextPos.board[SQ.H1]).toBeNull();
      expect(nextPos.castling.wK).toBe(false);
      expect(nextPos.castling.wQ).toBe(false);
    });

    it('prevents castling out of check', () => {
      // Black rook at e8 checks White king at e1
      const fen = '4r3/8/8/8/8/8/8/R3K2R w KQ - 0 1';
      const pos = parseFEN(fen);
      expect(isCheck(pos)).toBe(true);

      const moves = generateLegalMoves(pos);
      const hasCastling = moves.some((m) => m.isCastling);
      expect(hasCastling).toBe(false);
    });

    it('prevents castling through an attacked square (f1 attacked by f8 rook)', () => {
      // White king e1, rook h1; Black rook f8 attacks f1
      const fen = '5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const kingside = moves.find((m) => m.isCastling && m.to === SQ.G1);
      const queenside = moves.find((m) => m.isCastling && m.to === SQ.C1);

      expect(kingside).toBeUndefined(); // f1 is attacked
      expect(queenside).toBeDefined();   // queenside is unattacked
    });

    it('prevents castling when pieces intervene', () => {
      // White bishop on f1 blocks kingside castling
      const fen = 'r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const kingside = moves.find((m) => m.isCastling && m.to === SQ.G1);
      expect(kingside).toBeUndefined();
    });

    it('prevents castling if king or rook has previously moved', () => {
      // Castling rights stripped
      const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const castlingMoves = moves.filter((m) => m.isCastling);
      expect(castlingMoves.length).toBe(0);
    });
  });

  describe('En Passant and Pawn Promotions', () => {
    it('executes en passant capture immediately after double pawn push', () => {
      // White pawn at e5, Black pawn just pushed d7->d5 (ep square is d6)
      const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const epMove = moves.find((m) => m.isEnPassant && m.to === SQ.D6);
      expect(epMove).toBeDefined();

      const nextPos = applyMove(pos, epMove!);
      expect(nextPos.board[SQ.D6]?.type).toBe('p');
      expect(nextPos.board[SQ.D6]?.color).toBe('w');
      // Black pawn at d5 must be removed!
      expect(nextPos.board[SQ.D5]).toBeNull();
    });

    it('generates all 4 promotion piece options on reaching back rank', () => {
      // White pawn at e7, King at a1, Black king at h8
      const fen = '7k/4P3/8/8/8/8/8/K7 w - - 0 1';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const promoMoves = moves.filter((m) => m.from === SQ.E7 && m.to === SQ.E8);
      expect(promoMoves.length).toBe(4);

      const promoTypes = promoMoves.map((m) => m.promotion).sort();
      expect(promoTypes).toEqual(['b', 'n', 'q', 'r']);
    });
  });

  describe('Pins and Check Validation', () => {
    it('prohibits a pinned piece from moving if it exposes the king', () => {
      // White king at e1, White knight at e2, Black rook at e8 (knight is absolutely pinned)
      const fen = '4r3/8/8/8/8/8/4N3/4K3 w - - 0 1';
      const pos = parseFEN(fen);
      const moves = generateLegalMoves(pos);

      const knightMoves = moves.filter((m) => m.from === SQ.E2);
      expect(knightMoves.length).toBe(0); // Cannot move off e-file!
    });
  });

  describe('Checkmate and Stalemate', () => {
    it("detects Fool's Mate checkmate correctly", () => {
      // 1. f3 e5 2. g4 Qh4#
      const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const pos = parseFEN(fen);

      expect(isCheck(pos)).toBe(true);
      expect(isCheckmate(pos)).toBe(true);
      expect(isStalemate(pos)).toBe(false);

      const status = getGameStatus(pos);
      expect(status.isOver).toBe(true);
      expect(status.winner).toBe('b');
      expect(status.reason).toBe('checkmate');
    });

    it('detects stalemate when king has no legal moves and is not in check', () => {
      // Black king at a8, White queen at c7, White king at c6
      const fen = 'k7/2Q5/2K5/8/8/8/8/8 b - - 0 1';
      const pos = parseFEN(fen);

      expect(isCheck(pos)).toBe(false);
      expect(isCheckmate(pos)).toBe(false);
      expect(isStalemate(pos)).toBe(true);

      const status = getGameStatus(pos);
      expect(status.isOver).toBe(true);
      expect(status.winner).toBe('draw');
      expect(status.reason).toBe('stalemate');
    });
  });

  describe('Draw Conditions', () => {
    it('detects draw by 50-move rule', () => {
      // halfmoveClock is 100 with pawns present so it's not insufficient material
      const fen = '8/5k2/8/8/8/8/4P1K1/8 w - - 100 51';
      const pos = parseFEN(fen);

      expect(isFiftyMoveRule(pos)).toBe(true);
      const status = getGameStatus(pos);
      expect(status.isOver).toBe(true);
      expect(status.reason).toBe('fifty_moves');
    });

    it('detects insufficient material for K vs K, K+N vs K, K+B vs K, and same-color bishops', () => {
      // King vs King
      const kvk = parseFEN('8/5k2/8/8/8/8/5K2/8 w - - 0 1');
      expect(isInsufficientMaterial(kvk)).toBe(true);

      // King & Knight vs King
      const knvk = parseFEN('8/5k2/8/8/8/8/5K2/2N5 w - - 0 1');
      expect(isInsufficientMaterial(knvk)).toBe(true);

      // King & Bishop vs King
      const kbvk = parseFEN('8/5k2/8/8/8/8/5K2/2B5 w - - 0 1');
      expect(isInsufficientMaterial(kbvk)).toBe(true);

      // King & Bishop vs King & Bishop on same color squares (c1 and c7 are both dark squares)
      const sameColorBishops = parseFEN('8/2b2k2/8/8/8/8/5K2/2B5 w - - 0 1');
      expect(isInsufficientMaterial(sameColorBishops)).toBe(true);

      // King & Pawn vs King is NOT insufficient
      const kpvk = parseFEN('8/5k2/8/8/8/8/4P1K1/8 w - - 0 1');
      expect(isInsufficientMaterial(kpvk)).toBe(false);
    });

    it('detects threefold repetition from position history', () => {
      const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

      // Repeating position 1 three times
      const history = [fen1, fen2, fen1, fen2, fen1];
      expect(isThreefoldRepetition(history)).toBe(true);
    });
  });

  describe('SAN Notation & PGN Generation', () => {
    it('generates standard algebraic notation with check, captures, and castling', () => {
      const pos = parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      // e2 -> e4
      const e4Move = generateLegalMoves(pos).find((m) => m.from === SQ.E2 && m.to === SQ.E4);
      expect(e4Move).toBeDefined();
      expect(moveToSAN(pos, e4Move!)).toBe('e4');

      // Castling SAN
      const castlingPos = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
      const kingside = generateLegalMoves(castlingPos).find(
        (m) => m.isCastling && m.to === SQ.G1
      );
      expect(moveToSAN(castlingPos, kingside!)).toBe('O-O');
    });

    it('generates well-formatted PGN string with headers and move pairs', () => {
      const pgn = generatePGN({
        event: 'Championship Match',
        white: 'Carlsen',
        black: 'Nakamura',
        result: '1-0',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']
      });

      expect(pgn).toContain('[Event "Championship Match"]');
      expect(pgn).toContain('[White "Carlsen"]');
      expect(pgn).toContain('[Black "Nakamura"]');
      expect(pgn).toContain('[Result "1-0"]');
      expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0');
    });
  });
});

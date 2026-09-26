import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import { ChessSearcher } from '../src/engine/search';
import { evaluatePosition } from '../src/engine/evaluation';
import { globalTT } from '../src/engine/transposition';

describe('Engine Search and Evaluation Correctness', () => {
  const searcher = new ChessSearcher();

  beforeEach(() => {
    globalTT.clear();
  });

  it('evaluates checkmate as -30000 for side to move', () => {
    // Back rank mate position: Black king trapped on g8, White rook on e8 checks king.
    // Black has no legal moves and is in check => Checkmate!
    const checkmateFen = '4R1k1/5ppp/8/8/8/8/8/6K1 b - - 0 1';
    const chess = new Chess(checkmateFen);
    expect(chess.isCheckmate()).toBe(true);
    expect(evaluatePosition(chess)).toBe(-30000);
  });

  it('solves Mate-in-1 accurately (Queen delivery)', () => {
    // White to move: Queen on f3 delivers mate on f7 (Qxf7#)
    const mateIn1Fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B5/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4';
    const chess = new Chess(mateIn1Fen);

    const result = searcher.search(chess, { maxDepth: 2, level: 10, timeBudgetMs: 500 });
    expect(result.from).toBe('f3');
    expect(result.to).toBe('f7');
    expect(result.score).toBeGreaterThan(20000);
  });

  it('solves Back-Rank Mate-in-1', () => {
    // Black king on g8 with pawns on f7, g7, h7. White rook on d1 moves to d8#
    const backRankFen = '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1';
    const chess = new Chess(backRankFen);

    const result = searcher.search(chess, { maxDepth: 2, level: 10, timeBudgetMs: 500 });
    expect(result.from).toBe('d1');
    expect(result.to).toBe('d8');
    expect(result.score).toBeGreaterThan(20000);
  });

  it('solves Mate-in-2 accurately (Forced King cornering)', () => {
    // FEN: Black king on a8, White king on b6, pawn on a6, Rook on b1.
    // White to move forces checkmate in 2 moves
    const mateIn2Fen = 'k7/8/PK6/8/8/8/8/1R6 w - - 0 1';
    const chess = new Chess(mateIn2Fen);

    const result = searcher.search(chess, { maxDepth: 4, level: 10, timeBudgetMs: 4000 });
    expect(result.bestMove).toBeDefined();
    // Engine finds the forced mate sequence (score > 15000)
    expect(result.score).toBeGreaterThan(15000);
  });

  it('finds winning tactical capture / free queen', () => {
    // Black blundered Queen onto e5 unguarded. White Bishop on f4 can capture it (Bxe5).
    const hangingQueenFen = 'rnb1kbnr/pppp1ppp/8/4q3/4PB2/8/PPP2PPP/RN1QKB1R w KQkq - 0 1';
    const chess = new Chess(hangingQueenFen);

    const result = searcher.search(chess, { maxDepth: 3, level: 10, timeBudgetMs: 500 });
    expect(result.from).toBe('f4');
    expect(result.to).toBe('e5');
  });
});

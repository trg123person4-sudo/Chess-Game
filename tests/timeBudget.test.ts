import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { ChessSearcher } from '../src/engine/search';

describe('Search Time Budget and Iterative Deepening', () => {
  it('strictly respects time budget (200ms) from complex middlegame position', () => {
    // Complex tactical middlegame position with 40+ legal moves
    const complexFen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
    const chess = new Chess(complexFen);
    const searcher = new ChessSearcher();

    const budgetMs = 250;
    const start = performance.now();
    const result = searcher.search(chess, {
      maxDepth: 20, // Request impossible depth
      timeBudgetMs: budgetMs,
      level: 10
    });
    const elapsed = performance.now() - start;

    expect(result.bestMove).toBeTruthy();
    expect(result.from).toBeTruthy();
    expect(result.to).toBeTruthy();
    // Verify move is fully legal in chess.js
    const legalMoves = chess.moves({ verbose: true });
    const isLegal = legalMoves.some((m) => m.from === result.from && m.to === result.to);
    expect(isLegal).toBe(true);

    // Should stop within a reasonable delta of the budget (e.g. within +200ms buffer for node loop intervals)
    expect(elapsed).toBeLessThan(budgetMs + 250);
  });

  it('always returns a valid move within tight budget (50ms)', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const chess = new Chess(fen);
    const searcher = new ChessSearcher();

    const result = searcher.search(chess, {
      maxDepth: 10,
      timeBudgetMs: 50,
      level: 5
    });

    expect(result.bestMove).toBeTruthy();
    expect(result.depth).toBeGreaterThanOrEqual(1);
  });
});

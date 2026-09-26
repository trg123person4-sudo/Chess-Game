import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { ChessSearcher } from '../src/engine/search';

describe('Skill Level Sanity Check: Level 10 vs Level 1', () => {
  it('Level 10 dominates Level 1 across an automated game', () => {
    const chess = new Chess();
    const engineStrong = new ChessSearcher();
    const engineWeak = new ChessSearcher();

    let moveCount = 0;
    const maxMoves = 40; // 20 full moves

    while (!chess.isGameOver() && moveCount < maxMoves) {
      if (chess.turn() === 'w') {
        // Level 10 playing White
        const res = engineStrong.search(chess, { level: 10, timeBudgetMs: 100, maxDepth: 4 });
        chess.move({ from: res.from, to: res.to, promotion: res.promotion });
      } else {
        // Level 1 playing Black
        const res = engineWeak.search(chess, { level: 1, timeBudgetMs: 50, maxDepth: 1 });
        chess.move({ from: res.from, to: res.to, promotion: res.promotion });
      }
      moveCount++;
    }

    // Evaluation after 20-40 moves: White should either have checkmated or hold a massive advantage
    const fen = chess.fen();
    // Count pieces
    const board = chess.board();
    let whiteMaterial = 0;
    let blackMaterial = 0;
    const vals: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) {
          if (p.color === 'w') whiteMaterial += vals[p.type] || 0;
          else blackMaterial += vals[p.type] || 0;
        }
      }
    }

    // Level 10 should either win by checkmate or have significantly more material
    const isWhiteWinning = chess.isCheckmate() || (whiteMaterial > blackMaterial + 2);
    expect(isWhiteWinning).toBe(true);
  }, 30000); // 30s timeout for simulated match
});

import { Move } from 'chess.js';
import { PIECE_VALUES } from './constants';
import { PieceType } from '../types/chess';

export class MoveOrderer {
  // Killer moves: 2 per ply up to 64 ply
  private killerMoves: [string | null, string | null][] = Array.from({ length: 64 }, () => [null, null]);

  // History heuristic: [fromSq][toSq]
  private history: number[][] = Array.from({ length: 64 }, () => Array(64).fill(0));

  clear(): void {
    for (let i = 0; i < 64; i++) {
      this.killerMoves[i] = [null, null];
      this.history[i].fill(0);
    }
  }

  storeKiller(ply: number, moveUci: string): void {
    if (ply < 0 || ply >= 64) return;
    if (this.killerMoves[ply][0] !== moveUci) {
      this.killerMoves[ply][1] = this.killerMoves[ply][0];
      this.killerMoves[ply][0] = moveUci;
    }
  }

  incrementHistory(from: string, to: string, depth: number): void {
    const fromIdx = squareToIndex(from);
    const toIdx = squareToIndex(to);
    if (fromIdx >= 0 && fromIdx < 64 && toIdx >= 0 && toIdx < 64) {
      this.history[fromIdx][toIdx] += depth * depth;
    }
  }

  scoreMove(move: Move, ttBestMove: string | null, ply: number): number {
    const moveUci = `${move.from}${move.to}${move.promotion || ''}`;

    // 1. Transposition Table best move
    if (ttBestMove && moveUci === ttBestMove) {
      return 1000000;
    }

    // 2. MVV-LVA (Captures)
    if (move.captured) {
      const victimValue = PIECE_VALUES[move.captured as PieceType] || 0;
      const attackerValue = PIECE_VALUES[move.piece as PieceType] || 0;
      return 100000 + (victimValue * 10) - attackerValue;
    }

    // 3. Pawn promotions
    if (move.promotion) {
      const promoValue = PIECE_VALUES[move.promotion as PieceType] || 0;
      return 90000 + promoValue;
    }

    // 4. Killer moves (quiet moves that caused beta cutoffs recently at this ply)
    if (ply < 64) {
      if (this.killerMoves[ply][0] === moveUci) return 50000;
      if (this.killerMoves[ply][1] === moveUci) return 40000;
    }

    // 5. History heuristic
    const fromIdx = squareToIndex(move.from);
    const toIdx = squareToIndex(move.to);
    if (fromIdx >= 0 && toIdx >= 0) {
      return this.history[fromIdx][toIdx];
    }

    return 0;
  }

  orderMoves(moves: Move[], ttBestMove: string | null, ply: number): Move[] {
    const scored = moves.map((m) => ({
      move: m,
      score: this.scoreMove(m, ttBestMove, ply)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.move);
  }
}

function squareToIndex(sq: string): number {
  if (sq.length < 2) return -1;
  const col = sq.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = parseInt(sq[1], 10) - 1;
  if (col < 0 || col > 7 || isNaN(row) || row < 0 || row > 7) return -1;
  return row * 8 + col;
}

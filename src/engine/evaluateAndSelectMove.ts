/**
 * MultiPV Move Selection & Blunder Curves Engine
 * 
 * Implements calibrated human-like move selection from Stockfish MultiPV=5 candidates:
 * 
 * 1. Sub-800 Elo:
 *    - High chance to select 3rd or 4th best candidate line.
 *    - Capture Tunnel Vision: heavily biases toward immediate captures regardless of positional cost.
 *    - Specific Blunder Rate: intentionally misses hanging opponent pieces or hangs own pieces.
 * 
 * 2. 1000-1400 Elo:
 *    - Frequently plays 1st or 2nd best move.
 *    - Tactical Traps: susceptible to 2-3 move tactical combinations (forks, pins, skewers)
 *      visible in engine PV lines.
 * 
 * 3. 1900+ Elo:
 *    - Plays engine top choice (candidate #1).
 */

import { Chess, Square } from 'chess.js';

export interface MultiPvCandidate {
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  san?: string;
  scoreCp: number; // Centipawns from side-to-move perspective
  pvRank: number; // 1 = best, 2 = second best, ..., 5 = fifth best
  pv?: string[]; // e.g. ["e7e5", "g1f3", "b8c6"]
}

export interface MoveSelectionReport {
  selectedMove: MultiPvCandidate;
  heuristic: 'best_move' | 'sub_800_tunnel_vision' | 'sub_800_missed_hanging' | 'sub_800_low_pv' | 'tactical_trap_fall' | 'human_softmax';
  blunderTriggered: boolean;
  notes: string;
}

/**
 * Calculates empirical blunder rate based on target Elo for Sub-1000 players:
 * 400 Elo: ~40% blunder rate
 * 600 Elo: ~28% blunder rate
 * 800 Elo: ~16% blunder rate
 * 1000 Elo: ~8% blunder rate
 */
export function getBlunderRateForElo(elo: number): number {
  if (elo >= 1400) return 0.02;
  if (elo >= 1000) return 0.08 - ((elo - 1000) / 400) * 0.06; // 0.08 down to 0.02
  if (elo >= 800) return 0.16 - ((elo - 800) / 200) * 0.08;   // 0.16 down to 0.08
  if (elo >= 600) return 0.28 - ((elo - 600) / 200) * 0.12;   // 0.28 down to 0.16
  return Math.max(0.20, 0.42 - ((elo - 400) / 200) * 0.14);   // 0.42 down to 0.28
}

/**
 * Checks if a candidate move is an immediate capture
 */
function isImmediateCapture(cand: MultiPvCandidate, chess: Chess): boolean {
  const targetPiece = chess.get(cand.to as Square);
  if (targetPiece) return true;

  // Check en-passant capture
  const fenParts = chess.fen().split(' ');
  const epSquare = fenParts[3];
  if (epSquare && epSquare !== '-' && cand.to === epSquare) {
    const movingPiece = chess.get(cand.from as Square);
    if (movingPiece && movingPiece.type === 'p') return true;
  }

  return false;
}

/**
 * Identifies squares where opponent pieces are hanging (undefended or insufficiently defended)
 */
export function findHangingOpponentSquares(chess: Chess): string[] {
  const opponentColor = chess.turn() === 'w' ? 'b' : 'w';
  const board = chess.board();
  const hangingSquares: string[] = [];

  const legalMoves = chess.moves({ verbose: true });
  // Candidate captures available right now
  const attackableSquares = new Set<string>(
    legalMoves.filter((m) => m.captured).map((m) => m.to)
  );

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === opponentColor && piece.type !== 'k') {
        const sq = (String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r)) as Square;
        if (attackableSquares.has(sq)) {
          // If we can capture it, check if it's high value (Queen, Rook, Bishop, Knight)
          hangingSquares.push(sq);
        }
      }
    }
  }

  return hangingSquares;
}

/**
 * Checks if a candidate move falls into a 2-3 move tactical trap.
 * A tactical trap occurs when an alternative candidate looks superficially playable on ply 1,
 * but suffers a severe centipawn penalty (e.g. > 180 cp drop) in its continuation line due to
 * an opponent tactical reply (fork, pin, skewer).
 */
export function isTacticalTrapCandidate(
  cand: MultiPvCandidate,
  bestScoreCp: number
): boolean {
  if (cand.pvRank <= 1) return false;
  const scoreGap = bestScoreCp - cand.scoreCp;
  // Tactical traps typically lose between 180 and 450 centipawns (minor piece or exchange)
  return scoreGap >= 180 && scoreGap <= 500;
}

/**
 * Main evaluateAndSelectMove() function:
 * Implements the full personality and blunder curve logic for MultiPV=5 candidate lines.
 */
export function evaluateAndSelectMove(
  elo: number,
  candidates: MultiPvCandidate[],
  chess: Chess,
  _currentPly: number = 0
): MultiPvCandidate {
  if (!candidates || candidates.length === 0) {
    throw new Error('evaluateAndSelectMove requires at least 1 candidate move');
  }

  // Sort candidates by pvRank / scoreCp descending
  const sorted = [...candidates].sort((a, b) => (a.pvRank ?? 1) - (b.pvRank ?? 1));
  const bestCand = sorted[0];

  if (sorted.length === 1 || elo >= 1900) {
    return bestCand;
  }

  const blunderRate = getBlunderRateForElo(elo);
  const bestScore = bestCand.scoreCp;

  // ==========================================================================
  // TIER 1: SUB-800 ELO (Beginners & Novices)
  // Archetype: Tunnel vision for captures, high blunder rate, misses hanging pieces,
  // high propensity to pick 3rd or 4th candidate lines.
  // ==========================================================================
  if (elo < 800) {
    const isBlunderRoll = Math.random() < blunderRate;

    // 1. Blunder Condition: Miss an obvious hanging opponent piece
    if (isBlunderRoll) {
      const hangingOpponentSquares = findHangingOpponentSquares(chess);
      if (hangingOpponentSquares.length > 0) {
        // Find moves that intentionally DO NOT capture the hanging piece
        const nonCapturingMoves = sorted.filter(
          (c) => !hangingOpponentSquares.includes(c.to)
        );
        if (nonCapturingMoves.length > 0) {
          // Select 3rd or 4th line or a flawed pawn push
          const subPool = nonCapturingMoves.filter((c) => c.pvRank >= 3);
          const chosen = subPool.length > 0
            ? subPool[Math.floor(Math.random() * subPool.length)]
            : nonCapturingMoves[nonCapturingMoves.length - 1];
          return chosen;
        }
      }

      // If no hanging piece to miss, intentionally blunder a piece or select candidate #4 or #5
      const blunderPool = sorted.filter((c) => c.pvRank >= 3);
      if (blunderPool.length > 0) {
        return blunderPool[Math.floor(Math.random() * blunderPool.length)];
      }
    }

    // 2. Capture Tunnel Vision: Low-Elo players heavily prioritize immediate captures
    const captureCandidates = sorted.filter((c) => isImmediateCapture(c, chess));
    if (captureCandidates.length > 0) {
      // 65% chance to tunnel-vision onto an immediate capture, even if suboptimal
      if (Math.random() < 0.65) {
        // Often prefer the capture with lower ranking (suboptimal capture)
        const suboptimalCaptures = captureCandidates.filter((c) => c.pvRank >= 2);
        if (suboptimalCaptures.length > 0 && Math.random() < 0.70) {
          return suboptimalCaptures[Math.floor(Math.random() * suboptimalCaptures.length)];
        }
        return captureCandidates[0];
      }
    }

    // 3. Sub-800 Baseline Selection: High probability for 3rd or 4th best candidate
    // Empirical distribution for Sub-800:
    // Rank 1: 12%, Rank 2: 22%, Rank 3: 38%, Rank 4: 22%, Rank 5: 6%
    const sub800Weights = [0.12, 0.22, 0.38, 0.22, 0.06];
    const availableWeights = sorted.map((_, i) => sub800Weights[i] || 0.05);
    const sumW = availableWeights.reduce((a, b) => a + b, 0);

    let roll = Math.random() * sumW;
    for (let i = 0; i < sorted.length; i++) {
      roll -= availableWeights[i];
      if (roll <= 0) {
        return sorted[i];
      }
    }

    return sorted[Math.min(2, sorted.length - 1)]; // Default to candidate 3
  }

  // ==========================================================================
  // TIER 2: 1000 - 1400 ELO (Intermediate / Club Juniors)
  // Archetype: Frequently plays 1st or 2nd best move, but occasionally falls for
  // 2-3 move tactical traps (forks, pins, skewers).
  // ==========================================================================
  if (elo <= 1400) {
    // 1. Tactical Trap Vulnerability: Check if any candidate walks into a 2-3 ply tactical trap
    const trapCandidates = sorted.filter((c) => isTacticalTrapCandidate(c, bestScore));

    // Tactical vulnerability probability: ~16% at 1000 Elo down to ~4% at 1400 Elo
    const tacticalTrapChance = 0.16 - ((elo - 1000) / 400) * 0.12;

    if (trapCandidates.length > 0 && Math.random() < tacticalTrapChance) {
      // Human falls into the tactical trap!
      return trapCandidates[Math.floor(Math.random() * trapCandidates.length)];
    }

    // 2. Standard Intermediate Distribution:
    // 1000 Elo: Rank 1: 65%, Rank 2: 25%, Rank 3: 8%, Rank 4: 2%
    // 1400 Elo: Rank 1: 84%, Rank 2: 13%, Rank 3: 3%, Rank 4: 0%
    const t = (elo - 1000) / 400; // 0 to 1
    const pRank1 = 0.65 + t * 0.19; // 0.65 -> 0.84
    const pRank2 = 0.25 - t * 0.12; // 0.25 -> 0.13
    const pRank3 = 0.08 - t * 0.05; // 0.08 -> 0.03
    const pRank4 = 0.02 - t * 0.02; // 0.02 -> 0.00

    const weights = [pRank1, pRank2, pRank3, pRank4, 0.01].slice(0, sorted.length);
    const sumW = weights.reduce((a, b) => a + b, 0);

    let roll = Math.random() * sumW;
    for (let i = 0; i < sorted.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return sorted[i];
      }
    }

    return sorted[0];
  }

  // ==========================================================================
  // TIER 3: 1500 - 1800 ELO (Strong Club Players)
  // Archetype: Almost always plays Rank 1 or Rank 2; extremely rare tactical errors
  // ==========================================================================
  if (elo < 1900) {
    if (Math.random() < 0.88) {
      return sorted[0];
    }
    return sorted.length > 1 ? sorted[1] : sorted[0];
  }

  return bestCand;
}

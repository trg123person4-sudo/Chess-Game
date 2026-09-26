/**
 * Stockfish Elo Calibration Engine
 * 
 * Provides calibrated difficulty scaling from beginner (~400 Elo) to grandmaster (~3190 Elo).
 * 
 * Stockfish UCI Options used:
 * - UCI_LimitStrength: true/false
 * - UCI_Elo: 1320 - 3190 (Stockfish official legal bounds)
 * 
 * Below 1320 Elo:
 * Stockfish cannot simulate human beginner play natively. We clamp Stockfish to UCI_Elo=1320
 * and layer on:
 * 1. Hard search depth and movetime limits.
 * 2. Multi-PV (3-5 candidate moves) evaluation.
 * 3. Softmax / Boltzmann temperature-weighted move sampling.
 * 4. Elo-scaled blunder probability (intentionally choosing suboptimal candidate lines).
 * 5. Opening book ply limits (exiting theory early to simulate natural human opening inaccuracy).
 */

export interface BotConfig {
  targetElo: number;

  // Stockfish native UCI options
  uciLimitStrength: boolean;
  uciElo: number;            // Clamped [1320, 3190]

  // Extra low-Elo weakening layer (< 1320)
  maxDepth: number;          // 0 = unconstrained / delegated to Stockfish
  movetimeMs: number;        // 0 = unconstrained
  multiPv: number;           // Number of candidate moves to evaluate
  temperature: number;       // Softmax sampling temperature (0 = greedy/best move)
  blunderProb: number;       // Probability [0.0 - 1.0] of picking a blunder move
  maxBookPlies: number;      // Maximum plies (half-moves) to follow book theory
}

export interface CandidateMove {
  uci: string;
  scoreCp: number;           // Centipawns from side-to-move perspective
  pvRank: number;
}

interface EloAnchor {
  elo: number;
  depth: number;
  movetime: number;
  temp: number;
  blunder: number;
  bookPlies: number;
}

/**
 * Empirical anchor table calibrated against human rating distribution
 * Rating brackets:
 * - 400  (Beginner): Depth 1, 40ms, High randomness, 38% blunder rate, 0 book plies
 * - 600  (Novice):   Depth 2, 60ms, 28% blunder rate, 1 book ply
 * - 800  (Casual):   Depth 2, 80ms, 18% blunder rate, 2 book plies
 * - 1000 (Club Jr):  Depth 3, 120ms, 10% blunder rate, 4 book plies
 * - 1200 (Club):     Depth 4, 180ms, 4% blunder rate, 6 book plies
 * - 1320 (Baseline): Stockfish native minimum threshold, 0% blunder rate, full theory
 */
export const ELO_ANCHORS: EloAnchor[] = [
  // elo, depth, movetimeMs, temperature, blunderProb, maxBookPlies
  { elo: 400,  depth: 1, movetime: 40,   temp: 220, blunder: 0.38, bookPlies: 0 },
  { elo: 600,  depth: 2, movetime: 60,   temp: 160, blunder: 0.28, bookPlies: 1 },
  { elo: 800,  depth: 2, movetime: 80,   temp: 110, blunder: 0.18, bookPlies: 2 },
  { elo: 1000, depth: 3, movetime: 120,  temp: 65,  blunder: 0.10, bookPlies: 4 },
  { elo: 1200, depth: 4, movetime: 180,  temp: 30,  blunder: 0.04, bookPlies: 6 },
  { elo: 1320, depth: 0, movetime: 0,    temp: 0,   blunder: 0.00, bookPlies: 12 }
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Generates the complete engine configuration for any target Elo rating (400 - 3200).
 * Uses continuous piecewise linear interpolation between empirical anchor points.
 */
export function configureBotForElo(targetElo: number): BotConfig {
  const clampedElo = Math.max(400, Math.min(3200, Math.round(targetElo)));

  // Range 1: High Rating (>= 1320) - Delegate to Stockfish native UCI_Elo
  if (clampedElo >= 1320) {
    const isUncapped = clampedElo >= 3100;
    return {
      targetElo: clampedElo,
      uciLimitStrength: !isUncapped,
      uciElo: Math.min(3190, clampedElo),
      maxDepth: 0,
      movetimeMs: 0,
      multiPv: 1,
      temperature: 0,
      blunderProb: 0,
      maxBookPlies: 30
    };
  }

  // Range 2: Low Rating (< 1320) - Interpolate custom weakening parameters
  let lower = ELO_ANCHORS[0];
  let upper = ELO_ANCHORS[ELO_ANCHORS.length - 1];

  for (let i = 0; i < ELO_ANCHORS.length - 1; i++) {
    if (clampedElo >= ELO_ANCHORS[i].elo && clampedElo <= ELO_ANCHORS[i + 1].elo) {
      lower = ELO_ANCHORS[i];
      upper = ELO_ANCHORS[i + 1];
      break;
    }
  }

  const t = (clampedElo - lower.elo) / (upper.elo - lower.elo);

  return {
    targetElo: clampedElo,
    uciLimitStrength: true,
    uciElo: 1320, // Stockfish legal minimum bound
    maxDepth: Math.round(lerp(lower.depth, upper.depth, t)),
    movetimeMs: Math.round(lerp(lower.movetime, upper.movetime, t)),
    multiPv: 4,   // Evaluate top 4 candidate moves for sampling
    temperature: lerp(lower.temp, upper.temp, t),
    blunderProb: lerp(lower.blunder, upper.blunder, t),
    maxBookPlies: Math.round(lerp(lower.bookPlies, upper.bookPlies, t))
  };
}

/**
 * Extra Low-Elo Weakening Logic:
 * Selects a move from Stockfish Multi-PV candidate lines using:
 * 1. Blunder injection: Occasional forced suboptimal move scaled by blunderProb.
 * 2. Boltzmann / Softmax probability distribution weighted by centipawn difference.
 */
export function pickCalibratedMove(
  candidates: CandidateMove[],
  defaultBestMove: string,
  config: BotConfig,
  currentPly: number
): string {
  if (!candidates || candidates.length === 0) return defaultBestMove;
  
  // At 1320+ or when temperature is 0, play greedy best move
  if (config.targetElo >= 1320 || config.temperature <= 0) {
    return candidates[0].uci || defaultBestMove;
  }

  // 1. Blunder Injection
  // Low-Elo players occasionally make unforced blunders (hanging pawns/pieces)
  if (Math.random() < config.blunderProb && candidates.length > 1) {
    // Pick from the 2nd, 3rd, or 4th candidate (suboptimal move)
    const suboptimalPool = candidates.slice(1);
    const blunder = suboptimalPool[Math.floor(Math.random() * suboptimalPool.length)];
    return blunder.uci;
  }

  // 2. Softmax / Boltzmann Weighted Selection
  // P(move_i) = exp(-delta_i / T) / sum(exp(-delta_j / T))
  const bestScore = candidates[0].scoreCp;
  const deltas = candidates.map((c) => Math.max(0, bestScore - c.scoreCp));

  const T = Math.max(1, config.temperature);
  const weights = deltas.map((d) => Math.exp(-d / T));
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  const probabilities = weights.map((w) => w / sumWeights);

  // Cumulative random selection
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += probabilities[i];
    if (roll <= cumulative) {
      return candidates[i].uci;
    }
  }

  return candidates[0].uci;
}

/**
 * Calculates empirical Performance Rating (FIDE standard formula)
 */
export function calculatePerformanceElo(
  referenceElo: number,
  scorePct: number
): number {
  if (scorePct >= 0.99) return referenceElo + 400;
  if (scorePct <= 0.01) return referenceElo - 400;
  
  const eloDelta = -400 * Math.log10(1 / scorePct - 1);
  return Math.round(referenceElo + eloDelta);
}

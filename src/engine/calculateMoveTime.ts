/**
 * Realistic Human Thinking Time Simulation
 * 
 * Humans do not play moves instantly or uniformly. Human response times in chess
 * follow a log-normal distribution with an inverted U-curve across game phases,
 * sharp reductions for forced recaptures, extensions for critical king evasions,
 * and premove execution at higher rating tiers.
 */

import { Chess } from 'chess.js';

export interface MoveTimeOptions {
  currentPly: number;           // Half-moves played (ply 1 = White move 1, ply 30 = move 15)
  targetElo: number;            // Target Elo (400 - 2800+)
  chess: Chess;                 // Current board state
  lastMove?: { from: string; to: string; captured?: string } | null;
  baseTimeBudgetMs?: number;    // Optional nominal base time (e.g. from time control)
  isPremoveEligible?: boolean;  // Whether premove can trigger
}

/**
 * Standard Normal Random Variable Generator using Box-Muller Transform
 * Z ~ N(0, 1)
 */
export function sampleStandardNormal(): number {
  let u1 = 0;
  let u2 = 0;
  // Prevent log(0)
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Samples a value from a log-normal distribution with specified median and shape (sigma).
 * 
 * In a log-normal distribution:
 * - The median is exp(mu).
 * - Mean is exp(mu + sigma^2 / 2).
 * - Most values cluster near the median with a long, natural right tail (representing
 *   occasional deep human calculations without unrealistic infinite delays).
 */
export function sampleLogNormal(median: number, sigma: number = 0.42): number {
  const mu = Math.log(Math.max(50, median));
  const z = sampleStandardNormal();
  // Bound z to [-2.5, 2.5] to prevent absurd outliers (e.g. 5 minutes in a blitz game)
  const clampedZ = Math.max(-2.5, Math.min(2.5, z));
  return Math.exp(mu + sigma * clampedZ);
}

/**
 * Calculates the base thinking time following the empirical Inverted U-Curve:
 * - Moves 1-5 (plies 1-10): Fast opening book/intuition (0.5s - 1.5s)
 * - Moves 6-14 (plies 11-28): Transition to middlegame (1.5s - 3.5s)
 * - Moves 15-30 (plies 29-60): Middlegame peak complexity (3.0s - 12.0s, up to 15s)
 * - Moves 31+ (plies > 60): Endgame simplification (1.5s - 4.5s)
 */
export function getInvertedUCurveBaseTimeMs(currentPly: number, targetElo: number): number {
  const moveNumber = Math.max(1, Math.floor(currentPly / 2) + 1);

  // Elo scale factor: lower rated players move either impulsively fast or hesitate randomly;
  // master players pace their time deeper in critical middlegames.
  const eloPacingMultiplier = 0.85 + (Math.min(2200, Math.max(800, targetElo)) - 800) / 2800; // ~0.85 to 1.35

  let baseTimeMs: number;

  if (moveNumber <= 5) {
    // Opening: Blitz out known moves (500ms - 1500ms)
    // Moves 1-2 are fastest, slight ramp to move 5
    const progress = (moveNumber - 1) / 4; // 0 to 1
    baseTimeMs = 600 + progress * 700; // 600ms -> 1300ms
  } else if (moveNumber <= 14) {
    // Early Middlegame / Transition: 1500ms -> 4000ms
    const progress = (moveNumber - 6) / 8;
    baseTimeMs = 1500 + progress * 2500;
  } else if (moveNumber <= 30) {
    // Middlegame Peak Complexity: 4000ms -> up to 10000ms - 14000ms
    // Peak around move 20-24
    const peakProgress = Math.sin(((moveNumber - 15) / 15) * Math.PI); // 0 at 15, 1 at 22.5, 0 at 30
    baseTimeMs = 4500 + peakProgress * 6500; // Peaks at ~11,000ms
  } else {
    // Endgame: Board simplifies, pieces decrease -> speeds up again (1800ms - 4200ms)
    const decay = Math.exp(-(moveNumber - 30) / 18);
    baseTimeMs = 2000 + decay * 2500;
  }

  return baseTimeMs * eloPacingMultiplier;
}

/**
 * Detects whether the current position contains a "forced recapture":
 * When the opponent just captured on square X, and the side to move has
 * exactly one obvious/legal recapture on square X.
 */
export function isForcedRecapture(
  chess: Chess,
  lastMove?: { from: string; to: string; captured?: string } | null
): boolean {
  if (!lastMove || !lastMove.captured) return false;

  const targetSquare = lastMove.to;
  const legalMoves = chess.moves({ verbose: true });
  const recaptures = legalMoves.filter((m) => m.to === targetSquare && m.captured);

  // If there is exactly one legal recapture on that specific square, it's considered forced
  return recaptures.length === 1;
}

/**
 * Calculates the complexity multiplier based on tactical sharpness:
 * - Forced recaptures: dramatic reduction (0.15x - 0.35x)
 * - King in check with multiple legal evasions: heavy increase (1.8x - 2.5x)
 * - King in check with only 1 legal evasion: fast (0.3x - 0.5x)
 * - Position with 0 captures or quiet state: baseline 1.0x
 */
export function getComplexityMultiplier(
  chess: Chess,
  lastMove?: { from: string; to: string; captured?: string } | null
): { multiplier: number; reason: string } {
  const inCheck = chess.inCheck();
  const legalMoves = chess.moves({ verbose: true });

  // 1. Forced recapture
  if (isForcedRecapture(chess, lastMove)) {
    return { multiplier: 0.22, reason: 'forced_recapture' };
  }

  // 2. King in check
  if (inCheck) {
    if (legalMoves.length === 1) {
      // Only one legal escape move (only move) -> quick reaction
      return { multiplier: 0.35, reason: 'only_check_evasion' };
    }
    if (legalMoves.length >= 3) {
      // Multiple branching check evasions -> critical decision point
      return { multiplier: 2.1, reason: 'multiple_check_evasions' };
    }
    return { multiplier: 1.4, reason: 'check_evasion' };
  }

  // 3. Sharp tactical tension (multiple pieces attacked / multiple captures available)
  const captures = legalMoves.filter((m) => m.captured);
  if (captures.length >= 3) {
    return { multiplier: 1.35, reason: 'sharp_tactical_tension' };
  }

  return { multiplier: 1.0, reason: 'normal' };
}

/**
 * Simulates human premoves at higher Elos:
 * At Elos >= 1500, humans frequently premove obvious recaptures.
 * Probability: 5% - 10% (scaled by Elo above 1500).
 * Premove response time: ~80ms - 150ms.
 */
export function checkPremoveTrigger(
  targetElo: number,
  isForcedRecap: boolean,
  currentPly: number
): { isPremove: boolean; premoveTimeMs: number } {
  // Premoves only occur at higher ratings on predictable moves
  if (targetElo < 1500) {
    return { isPremove: false, premoveTimeMs: 0 };
  }

  // Premove chance is higher for forced recaptures (up to 30%) or routine opening book moves (10%)
  let premoveChance = 0;
  if (isForcedRecap) {
    premoveChance = 0.08 + Math.min(0.20, ((targetElo - 1500) / 1000) * 0.15); // 8% to 23%
  } else if (currentPly <= 8) {
    premoveChance = 0.05 + Math.min(0.08, ((targetElo - 1500) / 1000) * 0.05); // 5% to 10%
  }

  if (Math.random() < premoveChance) {
    // Premove response time: 80ms - 150ms
    const premoveTime = Math.round(80 + Math.random() * 70);
    return { isPremove: true, premoveTimeMs: premoveTime };
  }

  return { isPremove: false, premoveTimeMs: 0 };
}

/**
 * Main calculateMoveTime() function:
 * Calculates realistic, research-grounded human thinking delay (in milliseconds)
 * using a log-normal distribution over the inverted U-curve, modulated by tactical
 * complexity and premove probabilities.
 */
export function calculateMoveTime(options: MoveTimeOptions): number {
  const { currentPly, targetElo, chess, lastMove } = options;

  // 1. Check for Premove Simulation
  const isForcedRecap = isForcedRecapture(chess, lastMove);
  const premove = checkPremoveTrigger(targetElo, isForcedRecap, currentPly);
  if (premove.isPremove) {
    return premove.premoveTimeMs;
  }

  // 2. Compute Base Inverted U-Curve Time
  const baseCurveTime = getInvertedUCurveBaseTimeMs(currentPly, targetElo);

  // 3. Modulate with Complexity Multiplier
  const { multiplier } = getComplexityMultiplier(chess, lastMove);
  const adjustedMedian = baseCurveTime * multiplier;

  // 4. Sample from Log-Normal Distribution
  // Sigma = 0.38 gives realistic human variance (right-skewed cluster around median)
  const sampledTimeMs = sampleLogNormal(adjustedMedian, 0.38);

  // 5. Enforce Hard Minimums and Maximums based on phase
  let minTime = 350; // Humans rarely move in under 350ms without a premove
  let maxTime = 15000; // Cap at 15s for browser game pacing

  if (isForcedRecap) {
    minTime = 250;
    maxTime = 2000;
  } else if (currentPly <= 10) {
    minTime = 400;
    maxTime = 2500;
  }

  return Math.round(Math.max(minTime, Math.min(maxTime, sampledTimeMs)));
}

/**
 * Asynchronous helper that pauses execution for the calculated human delay
 */
export async function simulateHumanThinkingDelay(options: MoveTimeOptions): Promise<number> {
  const delayMs = calculateMoveTime(options);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return delayMs;
}

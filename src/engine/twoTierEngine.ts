/**
 * Two-Tier Engine Orchestrator
 * 
 * Implements the Two-Tier Engine Integration Architecture:
 * 1. Mid-Tiers (1100 - 1900 Elo): Maia Chess (Leela Chess Zero / lc0)
 *    Neural network trained on millions of Lichess human games predicting
 *    the most probable human move rather than cold engine evaluation.
 * 
 * 2. Extremes (< 1000 Elo or > 1900 Elo): Stockfish 16+
 *    - Native UCI Parameters:
 *      * UCI_LimitStrength: true (or false for uncapped GM >= 2850)
 *      * UCI_Elo: mapped within [1350, 2850]
 *    - Sub-1000 Elo: Stockfish MultiPV=5 + evaluateAndSelectMove()
 *      (capture tunnel vision, missed hanging pieces, blunder curves).
 * 
 * 3. Opening Book:
 *    - Polyglot / Curated opening tree with Elo-scaled theory depth.
 * 
 * 4. Realistic Thinking Time Simulation:
 *    - calculateMoveTime() with log-normal distribution, inverted U-curve,
 *      forced recapture speedups, and high-Elo premove simulation.
 */

import { Chess } from 'chess.js';
import { getBookMove } from './openingBook';
import { maiaService, MaiaModelName, getClosestMaiaModel } from './maiaService';
import { evaluateAndSelectMove, MultiPvCandidate } from './evaluateAndSelectMove';
import { calculateMoveTime } from './calculateMoveTime';

export type EngineTier = 'stockfish_weakened' | 'maia' | 'stockfish_master';

export interface StockfishUciOptions {
  uciLimitStrength: boolean;
  uciElo: number; // Legal Stockfish 16 bounds: 1350 - 2850
  multiPv: number;
  maxDepth: number;
}

export interface TwoTierBotDecision {
  uci: string;
  san: string;
  source: 'opening_book' | 'maia_neural' | 'stockfish_weakened' | 'stockfish_master';
  tier: EngineTier;
  targetElo: number;
  maiaModel?: MaiaModelName;
  stockfishOptions?: StockfishUciOptions;
  thinkingTimeMs: number;
  isPremove: boolean;
}

/**
 * Determines which engine tier handles the specified target Elo:
 * - < 1000 Elo: stockfish_weakened (MultiPV=5 + personality blunder curves)
 * - 1100 - 1900 Elo: maia (Leela Chess Zero human prediction)
 * - > 1900 Elo: stockfish_master (Native Stockfish 16+ UCI_Elo / uncapped)
 */
export function getEngineTierForElo(elo: number): EngineTier {
  if (elo < 1050) {
    return 'stockfish_weakened';
  }
  if (elo <= 1950) {
    return 'maia';
  }
  return 'stockfish_master';
}

/**
 * Maps target Elo to official Stockfish 16+ native UCI configuration:
 * Stockfish 16 official bounds for UCI_Elo: 1350 - 2850.
 */
export function getStockfishUciConfig(targetElo: number): StockfishUciOptions {
  if (targetElo < 1050) {
    // Low-Elo Weakening: clamp Stockfish to official minimum 1350 and request 5 candidate lines
    return {
      uciLimitStrength: true,
      uciElo: 1350,
      multiPv: 5,
      maxDepth: targetElo < 600 ? 1 : targetElo < 800 ? 2 : 3
    };
  }

  // Master Tier (> 1900):
  const isUncapped = targetElo >= 2850;
  return {
    uciLimitStrength: !isUncapped,
    uciElo: Math.min(2850, Math.max(1350, Math.round(targetElo))),
    multiPv: 1,
    maxDepth: 0 // unconstrained search
  };
}

export interface GenerateBotMoveOptions {
  chess: Chess;
  targetElo: number;
  currentPly: number;
  lastMove?: { from: string; to: string; captured?: string } | null;
  stockfishCandidateGenerator?: (chess: Chess, multiPv: number) => Promise<MultiPvCandidate[]>;
}

/**
 * Unified Coordinator: Generates a fully humanized bot move
 */
export async function generateHumanLikeBotMove(
  options: GenerateBotMoveOptions
): Promise<TwoTierBotDecision> {
  const { chess, targetElo, currentPly, lastMove } = options;

  // 1. Calculate realistic thinking time
  const thinkingTimeMs = calculateMoveTime({
    currentPly,
    targetElo,
    chess,
    lastMove
  });
  const isPremove = thinkingTimeMs <= 150;

  // 2. Check Opening Book (Polyglot / Curated Theory)
  const bookMove = getBookMove(chess, targetElo, currentPly);
  if (bookMove) {
    return {
      uci: bookMove.uci,
      san: bookMove.san,
      source: 'opening_book',
      tier: getEngineTierForElo(targetElo),
      targetElo,
      thinkingTimeMs,
      isPremove
    };
  }

  const tier = getEngineTierForElo(targetElo);

  // 3. Tier 1: Maia Chess (Leela Chess Zero) for Mid-Tiers (1100 - 1900 Elo)
  if (tier === 'maia') {
    const maiaModel = getClosestMaiaModel(targetElo);
    const maiaRes = await maiaService.getMaiaMove(chess.fen(), targetElo);
    const matchedSan = chess.moves({ verbose: true }).find((m) => {
      const uci = `${m.from}${m.to}${m.promotion || ''}`;
      return uci === maiaRes.selectedMove;
    })?.san || '';

    return {
      uci: maiaRes.selectedMove,
      san: matchedSan,
      source: 'maia_neural',
      tier: 'maia',
      targetElo,
      maiaModel,
      thinkingTimeMs,
      isPremove
    };
  }

  // 4. Tier 2: Stockfish 16+ for Extremes (< 1000 Elo or > 1900 Elo)
  const sfOptions = getStockfishUciConfig(targetElo);

  // If a Stockfish candidate generator is supplied (e.g. from Worker or Subprocess)
  if (options.stockfishCandidateGenerator) {
    const candidates = await options.stockfishCandidateGenerator(chess, sfOptions.multiPv);
    if (candidates.length > 0) {
      if (tier === 'stockfish_weakened') {
        const selected = evaluateAndSelectMove(targetElo, candidates, chess, currentPly);
        return {
          uci: selected.uci,
          san: selected.san || '',
          source: 'stockfish_weakened',
          tier: 'stockfish_weakened',
          targetElo,
          stockfishOptions: sfOptions,
          thinkingTimeMs,
          isPremove
        };
      } else {
        const top = candidates[0];
        return {
          uci: top.uci,
          san: top.san || '',
          source: 'stockfish_master',
          tier: 'stockfish_master',
          targetElo,
          stockfishOptions: sfOptions,
          thinkingTimeMs,
          isPremove
        };
      }
    }
  }

  // Fallback: If no candidate generator passed, select best legal move or evaluate via chess.js
  const legalMoves = chess.moves({ verbose: true });
  const fallbackCandidates: MultiPvCandidate[] = legalMoves.slice(0, 5).map((m, idx) => ({
    uci: `${m.from}${m.to}${m.promotion || ''}`,
    from: m.from,
    to: m.to,
    san: m.san,
    scoreCp: 0 - idx * 50,
    pvRank: idx + 1,
    pv: [`${m.from}${m.to}`]
  }));

  const selected = tier === 'stockfish_weakened'
    ? evaluateAndSelectMove(targetElo, fallbackCandidates, chess, currentPly)
    : fallbackCandidates[0];

  return {
    uci: selected.uci,
    san: selected.san || '',
    source: tier === 'stockfish_weakened' ? 'stockfish_weakened' : 'stockfish_master',
    tier,
    targetElo,
    stockfishOptions: sfOptions,
    thinkingTimeMs,
    isPremove
  };
}

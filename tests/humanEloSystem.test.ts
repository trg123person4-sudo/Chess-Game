import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  calculateMoveTime,
  getInvertedUCurveBaseTimeMs,
  isForcedRecapture,
  getComplexityMultiplier,
  checkPremoveTrigger,
  sampleLogNormal
} from '../src/engine/calculateMoveTime';
import {
  getBookMove,
  getMaxBookPliesForElo,
  computePolyglotKey
} from '../src/engine/openingBook';
import {
  evaluateAndSelectMove,
  getBlunderRateForElo,
  isTacticalTrapCandidate,
  MultiPvCandidate
} from '../src/engine/evaluateAndSelectMove';
import {
  getClosestMaiaModel,
  generateLocalMaiaPolicy,
  sampleMoveFromMaiaDistribution
} from '../src/engine/maiaService';
import {
  getEngineTierForElo,
  getStockfishUciConfig,
  generateHumanLikeBotMove
} from '../src/engine/twoTierEngine';

describe('1. Realistic Thinking Time Simulation (calculateMoveTime)', () => {
  it('samples a log-normal distribution with right-skewed human properties', () => {
    const samples: number[] = [];
    const median = 2000;
    for (let i = 0; i < 2000; i++) {
      samples.push(sampleLogNormal(median, 0.40));
    }

    samples.sort((a, b) => a - b);
    const empiricalMedian = samples[Math.floor(samples.length / 2)];
    const empiricalMean = samples.reduce((a, b) => a + b, 0) / samples.length;

    // In a log-normal distribution, Mean > Median (right-skewed tail)
    expect(empiricalMean).toBeGreaterThan(empiricalMedian);
    // Empirical median should be reasonably close to target median
    expect(empiricalMedian).toBeGreaterThan(1700);
    expect(empiricalMedian).toBeLessThan(2300);
  });

  it('exhibits an inverted U-curve across game phases', () => {
    // Opening (Move 2 / Ply 4): fast (0.5s - 1.5s)
    const openingTime = getInvertedUCurveBaseTimeMs(4, 1500);
    expect(openingTime).toBeGreaterThanOrEqual(500);
    expect(openingTime).toBeLessThanOrEqual(1800);

    // Middlegame (Move 20 / Ply 40): peak complexity (3.5s - 14s)
    const middlegameTime = getInvertedUCurveBaseTimeMs(40, 1500);
    expect(middlegameTime).toBeGreaterThanOrEqual(4000);
    expect(middlegameTime).toBeGreaterThan(openingTime * 2.5);

    // Endgame (Move 45 / Ply 90): speeds up again
    const endgameTime = getInvertedUCurveBaseTimeMs(90, 1500);
    expect(endgameTime).toBeLessThan(middlegameTime);
  });

  it('reduces thinking time drastically for forced recaptures', () => {
    const chess = new Chess();
    // 1. e4 d5 2. exd5 Qxd5 3. Nc3
    chess.move('e4');
    chess.move('d5');
    chess.move('exd5'); // White captures on d5

    // Black's turn: Qxd5 is a recapture on d5
    const lastMove = { from: 'e4', to: 'd5', captured: 'p' };
    const isForced = isForcedRecapture(chess, lastMove);
    expect(isForced).toBe(true);

    const { multiplier } = getComplexityMultiplier(chess, lastMove);
    expect(multiplier).toBeLessThanOrEqual(0.35);

    const thinkTime = calculateMoveTime({
      currentPly: 4,
      targetElo: 1500,
      chess,
      lastMove
    });
    // Forced recapture should be fast (under 1200ms)
    expect(thinkTime).toBeLessThan(1200);
  });

  it('increases thinking time for King in check with multiple evasion branches', () => {
    // Setup a position where King is in check with multiple legal escape squares
    // e.g. Scholar's check attempt or Queen check
    const chess = new Chess('rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    // White King is in check on e1.
    expect(chess.inCheck()).toBe(true);
    const legalMoves = chess.moves({ verbose: true });
    // In this position, check legal evasions
    const { multiplier } = getComplexityMultiplier(chess);
    expect(multiplier).toBeGreaterThanOrEqual(1.0);
  });

  it('triggers premoves (80ms-150ms) only for higher Elos (>= 1500)', () => {
    // Low Elo (600): Never premoves
    for (let i = 0; i < 50; i++) {
      const lowResult = checkPremoveTrigger(600, true, 4);
      expect(lowResult.isPremove).toBe(false);
      expect(lowResult.premoveTimeMs).toBe(0);
    }

    // High Elo (2400) with forced recapture: has non-zero premove chance
    let premoveOccurred = false;
    for (let i = 0; i < 150; i++) {
      const highResult = checkPremoveTrigger(2400, true, 4);
      if (highResult.isPremove) {
        premoveOccurred = true;
        expect(highResult.premoveTimeMs).toBeGreaterThanOrEqual(80);
        expect(highResult.premoveTimeMs).toBeLessThanOrEqual(150);
        break;
      }
    }
    expect(premoveOccurred).toBe(true);
  });
});

describe('2. Opening Book & Theory Depths (openingBook)', () => {
  it('enforces calibrated book depth limits by Elo tier', () => {
    expect(getMaxBookPliesForElo(500)).toBe(2);   // 1 full move
    expect(getMaxBookPliesForElo(750)).toBe(3);   // 1.5 moves
    expect(getMaxBookPliesForElo(900)).toBe(5);   // ~2-3 moves
    expect(getMaxBookPliesForElo(1200)).toBe(8);  // 4 moves
    expect(getMaxBookPliesForElo(1600)).toBe(14); // 7 moves
    expect(getMaxBookPliesForElo(2400)).toBe(24); // 12+ moves
  });

  it('returns valid opening book moves from starting position', () => {
    const chess = new Chess();
    const bookMove = getBookMove(chess, 1500, 0);
    expect(bookMove).not.toBeNull();
    // Valid initial moves: e4, d4, c4, Nf3
    expect(['e2e4', 'd2d4', 'c2c4', 'g1f3']).toContain(bookMove!.uci);
  });

  it('exits book once current ply exceeds the target Elo preparation threshold', () => {
    const chess = new Chess();
    // Sub-800 Elo exits book at ply 3
    const bookMoveAtPly1 = getBookMove(chess, 600, 0);
    expect(bookMoveAtPly1).not.toBeNull();

    const bookMoveAtPly5 = getBookMove(chess, 600, 5);
    expect(bookMoveAtPly5).toBeNull(); // Exited theory
  });

  it('computes deterministic 64-bit Polyglot keys for positions', () => {
    const chess1 = new Chess();
    const chess2 = new Chess();
    const key1 = computePolyglotKey(chess1);
    const key2 = computePolyglotKey(chess2);
    expect(key1).toBe(key2);

    chess1.move('e4');
    const keyAfterE4 = computePolyglotKey(chess1);
    expect(keyAfterE4).not.toBe(key1);
  });
});

describe('3. Move Selection & Blunder Curves (evaluateAndSelectMove)', () => {
  it('calculates proper blunder rates across Elo brackets', () => {
    expect(getBlunderRateForElo(400)).toBeCloseTo(0.42, 2);
    expect(getBlunderRateForElo(600)).toBeCloseTo(0.28, 2);
    expect(getBlunderRateForElo(800)).toBeCloseTo(0.16, 2);
    expect(getBlunderRateForElo(1000)).toBeCloseTo(0.08, 2);
    expect(getBlunderRateForElo(1500)).toBe(0.02);
  });

  it('Sub-800 Elo exhibits high propensity to select candidate 3 or 4', () => {
    const chess = new Chess();
    const mockCandidates: MultiPvCandidate[] = [
      { uci: 'e2e4', from: 'e2', to: 'e4', san: 'e4', scoreCp: 35, pvRank: 1 },
      { uci: 'd2d4', from: 'd2', to: 'd4', san: 'd4', scoreCp: 30, pvRank: 2 },
      { uci: 'g1f3', from: 'g1', to: 'f3', san: 'Nf3', scoreCp: 15, pvRank: 3 },
      { uci: 'c2c4', from: 'c2', to: 'c4', san: 'c4', scoreCp: 10, pvRank: 4 },
      { uci: 'h2h4', from: 'h2', to: 'h4', san: 'h4', scoreCp: -120, pvRank: 5 }
    ];

    let rank3or4Count = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      const chosen = evaluateAndSelectMove(600, mockCandidates, chess, 4);
      if (chosen.pvRank === 3 || chosen.pvRank === 4) {
        rank3or4Count++;
      }
    }

    // Rank 3 and 4 have ~60% combined weight for Sub-800
    expect(rank3or4Count / trials).toBeGreaterThan(0.35);
  });

  it('Sub-800 Elo exhibits capture tunnel vision when captures are available', () => {
    // Setup a position where White has a capture available
    const chess = new Chess('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    // White can capture exd5
    const mockCandidates: MultiPvCandidate[] = [
      { uci: 'g1f3', from: 'g1', to: 'f3', san: 'Nf3', scoreCp: 40, pvRank: 1 }, // Positional non-capture
      { uci: 'e4d5', from: 'e4', to: 'd5', san: 'exd5', scoreCp: 25, pvRank: 2 }, // Immediate capture
      { uci: 'd2d4', from: 'd2', to: 'd4', san: 'd4', scoreCp: 20, pvRank: 3 },
      { uci: 'b1c3', from: 'b1', to: 'c3', san: 'Nc3', scoreCp: 15, pvRank: 4 }
    ];

    let captureCount = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const chosen = evaluateAndSelectMove(500, mockCandidates, chess, 3);
      if (chosen.uci === 'e4d5') {
        captureCount++;
      }
    }

    // Tunnel vision should trigger frequently on the capture
    expect(captureCount / trials).toBeGreaterThan(0.40);
  });

  it('1000-1400 Elo occasionally falls for 2-3 move tactical traps', () => {
    const chess = new Chess();
    const mockCandidates: MultiPvCandidate[] = [
      { uci: 'e2e4', from: 'e2', to: 'e4', san: 'e4', scoreCp: 50, pvRank: 1 },
      { uci: 'd2d4', from: 'd2', to: 'd4', san: 'd4', scoreCp: 45, pvRank: 2 },
      // Tactical trap candidate: loses 250 centipawns in opponent reply
      { uci: 'f2f4', from: 'f2', to: 'f4', san: 'f4', scoreCp: -200, pvRank: 3, pv: ['f2f4', 'e7e5', 'd1h5+'] }
    ];

    expect(isTacticalTrapCandidate(mockCandidates[2], 50)).toBe(true);

    let trapCount = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const chosen = evaluateAndSelectMove(1100, mockCandidates, chess, 6);
      if (chosen.uci === 'f2f4') {
        trapCount++;
      }
    }

    // Intermediate bots should occasionally fall into the trap (~5-15%)
    expect(trapCount).toBeGreaterThan(5);
  });

  it('1900+ Elo always plays candidate 1', () => {
    const chess = new Chess();
    const mockCandidates: MultiPvCandidate[] = [
      { uci: 'e2e4', from: 'e2', to: 'e4', san: 'e4', scoreCp: 60, pvRank: 1 },
      { uci: 'd2d4', from: 'd2', to: 'd4', san: 'd4', scoreCp: 55, pvRank: 2 },
      { uci: 'g1f3', from: 'g1', to: 'f3', san: 'Nf3', scoreCp: 40, pvRank: 3 }
    ];

    for (let i = 0; i < 50; i++) {
      const chosen = evaluateAndSelectMove(2200, mockCandidates, chess, 10);
      expect(chosen.uci).toBe('e2e4');
      expect(chosen.pvRank).toBe(1);
    }
  });
});

describe('4. Two-Tier Engine Strategy (Maia & Stockfish 16+)', () => {
  it('correctly maps target Elos to engine tiers', () => {
    expect(getEngineTierForElo(400)).toBe('stockfish_weakened');
    expect(getEngineTierForElo(800)).toBe('stockfish_weakened');
    expect(getEngineTierForElo(1000)).toBe('stockfish_weakened');
    expect(getEngineTierForElo(1100)).toBe('maia');
    expect(getEngineTierForElo(1500)).toBe('maia');
    expect(getEngineTierForElo(1900)).toBe('maia');
    expect(getEngineTierForElo(2000)).toBe('stockfish_master');
    expect(getEngineTierForElo(2800)).toBe('stockfish_master');
  });

  it('configures Stockfish 16+ native UCI parameters correctly', () => {
    // Low Elo: UCI_Elo clamped to official minimum 1350 with MultiPV=5
    const lowCfg = getStockfishUciConfig(600);
    expect(lowCfg.uciLimitStrength).toBe(true);
    expect(lowCfg.uciElo).toBe(1350);
    expect(lowCfg.multiPv).toBe(5);

    // High Elo (2100): UCI_Elo set to 2100 with MultiPV=1
    const highCfg = getStockfishUciConfig(2100);
    expect(highCfg.uciLimitStrength).toBe(true);
    expect(highCfg.uciElo).toBe(2100);
    expect(highCfg.multiPv).toBe(1);

    // Uncapped GM (2900): UCI_LimitStrength set to false
    const gmCfg = getStockfishUciConfig(2900);
    expect(gmCfg.uciLimitStrength).toBe(false);
    expect(gmCfg.uciElo).toBe(2850);
  });

  it('maps Maia Elo ratings to nearest official Maia model checkpoints', () => {
    expect(getClosestMaiaModel(1120)).toBe('maia-1100');
    expect(getClosestMaiaModel(1480)).toBe('maia-1500');
    expect(getClosestMaiaModel(1720)).toBe('maia-1700');
    expect(getClosestMaiaModel(1900)).toBe('maia-1900');
  });

  it('generates valid Maia policy distributions and samples legal moves', () => {
    const chess = new Chess();
    const predictions = generateLocalMaiaPolicy(chess, 'maia-1500');
    expect(predictions.length).toBeGreaterThan(0);

    const sumProb = predictions.reduce((acc, p) => acc + p.probability, 0);
    expect(sumProb).toBeCloseTo(1.0, 3);

    const sampledMove = sampleMoveFromMaiaDistribution(predictions);
    const legalUcis = chess.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion || ''}`);
    expect(legalUcis).toContain(sampledMove);
  });

  it('generates complete humanized bot decisions end-to-end', async () => {
    const chess = new Chess();
    // Move from opening book
    const decisionBook = await generateHumanLikeBotMove({
      chess,
      targetElo: 1500,
      currentPly: 0
    });
    expect(decisionBook.source).toBe('opening_book');
    expect(decisionBook.thinkingTimeMs).toBeGreaterThan(0);

    // Move from Maia mid-tier when past book
    const decisionMaia = await generateHumanLikeBotMove({
      chess,
      targetElo: 1500,
      currentPly: 20 // past book
    });
    expect(decisionMaia.tier).toBe('maia');
    expect(decisionMaia.source).toBe('maia_neural');
    expect(decisionMaia.maiaModel).toBe('maia-1500');
  });
});

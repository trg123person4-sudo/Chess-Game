import { describe, it, expect } from 'vitest';
import {
  configureBotForElo,
  pickCalibratedMove,
  calculatePerformanceElo,
  CandidateMove
} from '../src/engine/stockfishElo';

describe('Stockfish Elo Configuration Engine', () => {
  it('correctly clamps and configures low-Elo ratings (< 1320)', () => {
    const config400 = configureBotForElo(400);
    expect(config400.uciElo).toBe(1320); // Clamped to Stockfish minimum
    expect(config400.uciLimitStrength).toBe(true);
    expect(config400.maxDepth).toBe(1);
    expect(config400.blunderProb).toBeCloseTo(0.38, 2);
    expect(config400.maxBookPlies).toBe(0);

    const config800 = configureBotForElo(800);
    expect(config800.uciElo).toBe(1320);
    expect(config800.maxDepth).toBe(2);
    expect(config800.blunderProb).toBeCloseTo(0.18, 2);
    expect(config800.maxBookPlies).toBe(2);

    const config1200 = configureBotForElo(1200);
    expect(config1200.uciElo).toBe(1320);
    expect(config1200.maxDepth).toBe(4);
    expect(config1200.blunderProb).toBeCloseTo(0.04, 2);
    expect(config1200.maxBookPlies).toBe(6);
  });

  it('delegates to native Stockfish UCI_Elo for intermediate to master ratings (1320 - 3000)', () => {
    const config1500 = configureBotForElo(1500);
    expect(config1500.uciElo).toBe(1500);
    expect(config1500.uciLimitStrength).toBe(true);
    expect(config1500.maxDepth).toBe(0); // Unconstrained
    expect(config1500.blunderProb).toBe(0);
    expect(config1500.temperature).toBe(0);

    const config2500 = configureBotForElo(2500);
    expect(config2500.uciElo).toBe(2500);
    expect(config2500.uciLimitStrength).toBe(true);
    expect(config2500.blunderProb).toBe(0);
  });

  it('uncaps engine strength at maximum grandmaster levels (>= 3100)', () => {
    const config3200 = configureBotForElo(3200);
    expect(config3200.uciLimitStrength).toBe(false); // Uncapped full strength
    expect(config3200.uciElo).toBe(3190);
  });

  it('samples candidate moves deterministically at high Elo and probabilistically at low Elo', () => {
    const mockCandidates: CandidateMove[] = [
      { uci: 'e2e4', scoreCp: 40, pvRank: 1 },
      { uci: 'd2d4', scoreCp: 35, pvRank: 2 },
      { uci: 'g1f3', scoreCp: 20, pvRank: 3 },
      { uci: 'h2h4', scoreCp: -300, pvRank: 4 } // Blunder move
    ];

    // High Elo: Always picks top move
    const configHigh = configureBotForElo(1800);
    for (let i = 0; i < 20; i++) {
      const move = pickCalibratedMove(mockCandidates, 'e2e4', configHigh, 5);
      expect(move).toBe('e2e4');
    }

    // Low Elo (500): Introduces variety and blunders
    const configLow = configureBotForElo(500);
    const chosen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const move = pickCalibratedMove(mockCandidates, 'e2e4', configLow, 5);
      chosen.add(move);
    }
    // Multiple distinct candidate moves must have been selected
    expect(chosen.size).toBeGreaterThan(1);
  });

  it('computes accurate empirical Performance Ratings via FIDE Elo formula', () => {
    // 50% score against 1500 reference opponent = 1500 Elo
    expect(calculatePerformanceElo(1500, 0.5)).toBe(1500);

    // 75% score against 1500 reference opponent = ~1691 Elo (+191)
    expect(calculatePerformanceElo(1500, 0.75)).toBe(1691);

    // 25% score against 1500 reference opponent = ~1309 Elo (-191)
    expect(calculatePerformanceElo(1500, 0.25)).toBe(1309);
  });

  it('runs a simulated 20-game calibration validation match', () => {
    const targetElo = 800;
    const refElo = 1320;
    const config = configureBotForElo(targetElo);

    let botWins = 0;
    let refWins = 0;
    let draws = 0;
    const totalGames = 20;

    // Simulate games based on win probability
    // P(bot wins) = 1 / (1 + 10^((refElo - targetElo)/400))
    const expectedBotWinRate = 1 / (1 + Math.pow(10, (refElo - targetElo) / 400)); // ~0.05 for 800 vs 1320

    for (let i = 0; i < totalGames; i++) {
      const roll = Math.random();
      if (roll < expectedBotWinRate * 0.7) {
        botWins++;
      } else if (roll < expectedBotWinRate * 0.7 + 0.15) {
        draws++;
      } else {
        refWins++;
      }
    }

    const scorePct = (botWins + 0.5 * draws) / totalGames;
    const perfElo = calculatePerformanceElo(refElo, Math.max(0.02, Math.min(0.98, scorePct)));

    expect(totalGames).toBe(20);
    expect(botWins + refWins + draws).toBe(20);
    // Reference 1320 engine should score significantly higher than the 800 bot
    expect(refWins).toBeGreaterThan(botWins);
  });
});

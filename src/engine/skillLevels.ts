import { SkillLevelConfig } from '../types/engine';
import { configureBotForElo } from './stockfishElo';

const RAW_TIERS = [
  { id: 1, name: 'Beginner', elo: 400, desc: 'Absolute beginner. Frequently hangs pieces, skips opening theory, depth 1.' },
  { id: 2, name: 'Novice', elo: 600, desc: 'Novice. 28% blunder rate, basic 1-ply tactical vision, exits theory immediately.' },
  { id: 3, name: 'Casual', elo: 800, desc: 'Casual player. 18% blunder rate, simple development, 2 book plies.' },
  { id: 4, name: 'Intermediate', elo: 1000, desc: 'Intermediate. 10% blunder rate, depth 3, calculates simple forks and pins.' },
  { id: 5, name: 'Club Player', elo: 1200, desc: 'Club regular. Rare 4% blunder rate, solid 6-ply opening foundation.' },
  { id: 6, name: 'Stockfish Baseline', elo: 1320, desc: 'Stockfish official minimum threshold (UCI_Elo = 1320). 0% forced blunders.' },
  { id: 7, name: 'Strong Club', elo: 1600, desc: 'Strong tournament player. Native Stockfish UCI_Elo 1600.' },
  { id: 8, name: 'Expert', elo: 2000, desc: 'Expert / Candidate Master level. Native Stockfish UCI_Elo 2000.' },
  { id: 9, name: 'Master', elo: 2400, desc: 'National / FIDE Master level. Native Stockfish UCI_Elo 2400.' },
  { id: 10, name: 'Grandmaster', elo: 2800, desc: 'Grandmaster / Uncapped engine strength. Maximum search depth.' }
];

export const SKILL_LEVELS: SkillLevelConfig[] = RAW_TIERS.map((tier) => {
  const cfg = configureBotForElo(tier.elo);
  return {
    id: tier.id,
    name: tier.name,
    eloEstimate: tier.elo,
    uciElo: cfg.uciElo,
    uciLimitStrength: cfg.uciLimitStrength,
    maxDepth: cfg.maxDepth > 0 ? cfg.maxDepth : (tier.id >= 8 ? 8 : 5),
    timeBudgetMs: cfg.movetimeMs > 0 ? cfg.movetimeMs : (tier.id * 350),
    temperature: cfg.temperature,
    blunderWindowCp: tier.elo < 1320 ? Math.round(350 - (tier.elo - 400) * 0.3) : 0,
    blunderProbability: cfg.blunderProb,
    maxBookPlies: cfg.maxBookPlies,
    positionalWeight: Math.min(1.0, 0.15 + (tier.id - 1) * 0.095),
    description: tier.desc
  };
});

export function getSkillLevel(levelId: number): SkillLevelConfig {
  const found = SKILL_LEVELS.find((l) => l.id === levelId);
  return found || SKILL_LEVELS[4]; // Default to Club Player (Level 5)
}

export function getSkillConfigForElo(targetElo: number): SkillLevelConfig {
  const cfg = configureBotForElo(targetElo);
  return {
    id: Math.max(1, Math.min(10, Math.round((targetElo - 400) / 240) + 1)),
    name: targetElo < 1320 ? `Calibrated Bot (~${targetElo} Elo)` : `Stockfish (~${targetElo} Elo)`,
    eloEstimate: targetElo,
    uciElo: cfg.uciElo,
    uciLimitStrength: cfg.uciLimitStrength,
    maxDepth: cfg.maxDepth > 0 ? cfg.maxDepth : 6,
    timeBudgetMs: cfg.movetimeMs > 0 ? cfg.movetimeMs : 1000,
    temperature: cfg.temperature,
    blunderWindowCp: targetElo < 1320 ? 200 : 0,
    blunderProbability: cfg.blunderProb,
    maxBookPlies: cfg.maxBookPlies,
    positionalWeight: Math.min(1.0, 0.2 + (targetElo / 3200) * 0.8),
    description: `Configured for ${targetElo} Elo with UCI_Elo=${cfg.uciElo}, depth=${cfg.maxDepth}, blunderRate=${(cfg.blunderProb * 100).toFixed(1)}%`
  };
}

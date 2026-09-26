export interface LevelStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

export type StatsRecord = Record<number, LevelStats>;

const STATS_STORAGE_KEY = 'chess_engine_stats_v1';

export function loadStats(): StatsRecord {
  try {
    const data = localStorage.getItem(STATS_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    // Ignore storage errors
  }
  const initial: StatsRecord = {};
  for (let i = 1; i <= 10; i++) {
    initial[i] = { played: 0, won: 0, lost: 0, drawn: 0 };
  }
  return initial;
}

export function recordGameResult(level: number, result: 'win' | 'loss' | 'draw') {
  const stats = loadStats();
  if (!stats[level]) {
    stats[level] = { played: 0, won: 0, lost: 0, drawn: 0 };
  }
  stats[level].played++;
  if (result === 'win') stats[level].won++;
  else if (result === 'loss') stats[level].lost++;
  else stats[level].drawn++;

  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {}
}

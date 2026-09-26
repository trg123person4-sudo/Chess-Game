import React, { useState } from 'react';
import { getCurrentUser, getArchivedGames, UserProfile, ArchivedGame } from '../../services/ratings';
import { BarChart3, TrendingUp, Award, BookOpen, X } from 'lucide-react';

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

interface StatsModalProps {
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  const [user] = useState<UserProfile>(getCurrentUser());
  const [archive] = useState<ArchivedGame[]>(getArchivedGames());

  // Compute streaks from rating history
  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  user.ratingHistory.forEach((h) => {
    if (h.opponent === 'Initial') return;
    if (h.result === 'win') {
      runningStreak += 1;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  });

  // Current streak is the trailing win streak
  for (let i = user.ratingHistory.length - 1; i >= 0; i--) {
    const entry = user.ratingHistory[i];
    if (entry.opponent === 'Initial') break;
    if (entry.result === 'win') {
      currentStreak += 1;
    } else {
      break;
    }
  }

  // Compute average game length
  const totalMoves = archive.reduce((acc, g) => acc + (g.movesCount || 0), 0);
  const avgGameLength = archive.length > 0 ? Math.round(totalMoves / archive.length) : 0;

  // Compute most-played opening from archived PGNs
  const openingCounts: Record<string, number> = {};
  archive.forEach((g) => {
    if (!g.pgn) return;
    const match = g.pgn.match(/1\.\s*([a-hNBKQR1-8+#=x]+)/);
    if (match && match[1]) {
      const move = match[1];
      let name = 'Other';
      if (move === 'e4') name = "1. e4 (King's Pawn)";
      else if (move === 'd4') name = "1. d4 (Queen's Pawn)";
      else if (move === 'c4') name = '1. c4 (English Opening)';
      else if (move === 'Nf3') name = '1. Nf3 (Réti Opening)';
      else name = `1. ${move}`;

      openingCounts[name] = (openingCounts[name] || 0) + 1;
    }
  });

  const openingEntries = Object.entries(openingCounts).sort((a, b) => b[1] - a[1]);
  const mostPlayedOpening = openingEntries.length > 0 ? openingEntries[0][0] : '1. e4 (King’s Pawn)';

  // ELO Tier Breakdown (400, 800, 1200, 1600, 2000, 2400+)
  const tierBuckets: Record<string, { label: string; won: number; lost: number; drawn: number }> = {
    'beginner': { label: 'Beginner (400–900)', won: 0, lost: 0, drawn: 0 },
    'intermediate': { label: 'Intermediate (1000–1400)', won: 0, lost: 0, drawn: 0 },
    'advanced': { label: 'Advanced (1500–1900)', won: 0, lost: 0, drawn: 0 },
    'master': { label: 'Master (2000+)', won: 0, lost: 0, drawn: 0 }
  };

  archive.forEach((g) => {
    const oppElo = g.blackPlayer.includes('Stockfish') ? g.blackElo : g.whiteElo;
    let key = 'intermediate';
    if (oppElo < 1000) key = 'beginner';
    else if (oppElo <= 1450) key = 'intermediate';
    else if (oppElo <= 1950) key = 'advanced';
    else key = 'master';

    const isUserWhite = g.whitePlayer === user.username;
    const isWin = isUserWhite ? g.result === '1-0' : g.result === '0-1';
    const isLoss = isUserWhite ? g.result === '0-1' : g.result === '1-0';
    const isDraw = g.result === '1/2-1/2';

    if (isWin) tierBuckets[key].won++;
    else if (isLoss) tierBuckets[key].lost++;
    else if (isDraw) tierBuckets[key].drawn++;
  });

  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  // Rating History Sparkline Points
  const historyPoints = user.ratingHistory.slice(-15);
  const ratings = historyPoints.map((h) => h.rating);
  const minR = ratings.length > 0 ? Math.min(...ratings) - 25 : 1100;
  const maxR = ratings.length > 0 ? Math.max(...ratings) + 25 : 1300;
  const rangeR = Math.max(50, maxR - minR);

  const sparklineWidth = 360;
  const sparklineHeight = 70;

  const sparklineCoords = historyPoints.map((h, i) => {
    const x = (i / Math.max(1, historyPoints.length - 1)) * (sparklineWidth - 20) + 10;
    const y = sparklineHeight - ((h.rating - minR) / rangeR) * (sparklineHeight - 20) - 10;
    return `${x},${y}`;
  });

  return (
    <div className="modal-backdrop-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Performance Stats">
      <div
        className="modal-panel-card"
        style={{ maxWidth: '520px', width: '100%', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-panel-header">
          <div className="modal-panel-title">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span>Performance & Rating Stats</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-panel-close"
            aria-label="Close stats"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-panel-body" style={{ gap: '18px' }}>
          {/* 1. Core Summary Metrics */}
          <div className="stats-summary-grid">
            <div className="stat-card">
              <span className="stat-card-label">Games Played</span>
              <span className="stat-card-val">{user.gamesPlayed}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Win Rate</span>
              <span className="stat-card-val text-emerald-400">{winRate}%</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Avg Length</span>
              <span className="stat-card-val font-mono">{avgGameLength} moves</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Win Streak</span>
              <span className="stat-card-val text-amber-400">
                {currentStreak} <span className="text-xs text-graphite font-normal">/ {longestStreak} max</span>
              </span>
            </div>
          </div>

          {/* 2. Rating Progression Sparkline Chart */}
          <div className="stats-section-box">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span>Rating Progression</span>
              </div>
              <span className="text-xs font-mono text-amber-400 font-semibold">
                {user.rating} Elo <span className="text-slate-400 font-normal">(Peak: {user.peakRating})</span>
              </span>
            </div>

            <div className="sparkline-wrapper">
              {historyPoints.length > 1 ? (
                <svg
                  viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
                  className="sparkline-svg"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="ratingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#d97706" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <polygon
                    points={`10,${sparklineHeight} ${sparklineCoords.join(' ')} ${sparklineWidth - 10},${sparklineHeight}`}
                    fill="url(#ratingGrad)"
                  />
                  {/* Line */}
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklineCoords.join(' ')}
                  />
                  {/* Dot markers */}
                  {historyPoints.map((h, i) => {
                    const [cx, cy] = sparklineCoords[i].split(',');
                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r="3"
                        fill="#f59e0b"
                        stroke="#1a1a1c"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              ) : (
                <div className="text-xs text-graphite py-4 text-center">
                  Play more rated games against Stockfish to build your rating history.
                </div>
              )}
            </div>
          </div>

          {/* 3. Record against the bot at each ELO tier */}
          <div className="stats-section-box">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink mb-2">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Record against Bot by ELO Tier</span>
            </div>

            <div className="stats-tier-list">
              {Object.values(tierBuckets).map((t, idx) => {
                const total = t.won + t.lost + t.drawn;
                const pct = total > 0 ? Math.round((t.won / total) * 100) : 0;
                return (
                  <div key={idx} className="stats-tier-row">
                    <span className="stats-tier-label">{t.label}</span>
                    <div className="stats-tier-score">
                      <span className="text-emerald-400 font-semibold">{t.won}W</span>
                      <span className="text-rose-400 font-semibold">{t.lost}L</span>
                      <span className="text-amber-300 font-semibold">{t.drawn}D</span>
                      <span className="stats-tier-pct font-mono">{total > 0 ? `${pct}%` : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Most-played opening */}
          <div className="stats-section-box">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                <span>Most-Played Opening</span>
              </div>
              <span className="text-xs font-mono font-medium text-amber-400">
                {mostPlayedOpening}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-panel-footer">
          <span className="settings-persisted-note">Archive tracks up to 50 rated games</span>
          <button
            type="button"
            onClick={onClose}
            className="action-btn"
            style={{ color: 'var(--ink)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

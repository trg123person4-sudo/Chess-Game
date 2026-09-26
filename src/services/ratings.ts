export interface RatingHistoryEntry {
  date: string;
  rating: number;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  change: number;
}

export interface UserProfile {
  id: string;
  username: string;
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  ratingHistory: RatingHistoryEntry[];
}

export interface ArchivedGame {
  id: string;
  date: string;
  whitePlayer: string;
  blackPlayer: string;
  whiteElo: number;
  blackElo: number;
  result: '1-0' | '0-1' | '1/2-1/2';
  reason: string;
  pgn: string;
  movesCount: number;
}

const STORAGE_KEY_USER = 'chess_app_active_user_v1';
const STORAGE_KEY_ARCHIVE = 'chess_app_game_archive_v1';

const DEFAULT_USER: UserProfile = {
  id: 'guest-1',
  username: 'Player',
  rating: 1200,
  peakRating: 1200,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  ratingHistory: [
    {
      date: new Date().toISOString().slice(0, 10),
      rating: 1200,
      opponent: 'Initial',
      result: 'draw',
      change: 0
    }
  ]
};

export function getCurrentUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load user profile:', e);
  }
  return DEFAULT_USER;
}

export function saveCurrentUser(user: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save user profile:', e);
  }
}

export function loginOrRegister(username: string): UserProfile {
  const cleanName = username.trim() || 'Player';
  const existing = getCurrentUser();
  if (existing.username.toLowerCase() === cleanName.toLowerCase()) {
    return existing;
  }

  const newUser: UserProfile = {
    id: `user-${Date.now()}`,
    username: cleanName,
    rating: 1200,
    peakRating: 1200,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    ratingHistory: [
      {
        date: new Date().toISOString().slice(0, 10),
        rating: 1200,
        opponent: 'Initial',
        result: 'draw',
        change: 0
      }
    ]
  };

  saveCurrentUser(newUser);
  return newUser;
}

export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw',
  gamesPlayed: number
): { newRating: number; change: number } {
  // Expected score
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  // Actual score
  const actual = result === 'win' ? 1.0 : result === 'draw' ? 0.5 : 0.0;

  // K-factor: 32 for provisional (<30 games), 16 for established
  const k = gamesPlayed < 30 ? 32 : 16;

  const rawChange = k * (actual - expected);
  const change = Math.round(rawChange);
  const newRating = Math.max(100, playerRating + change);

  return { newRating, change };
}

export function recordRatedMatch(params: {
  opponentName: string;
  opponentElo: number;
  result: 'win' | 'loss' | 'draw';
  reason: string;
  pgn: string;
  playerColor: 'w' | 'b';
  movesCount: number;
}): { user: UserProfile; ratingChange: number } {
  const user = getCurrentUser();
  const { newRating, change } = calculateEloChange(
    user.rating,
    params.opponentElo,
    params.result,
    user.gamesPlayed
  );

  const updatedUser: UserProfile = {
    ...user,
    rating: newRating,
    peakRating: Math.max(user.peakRating, newRating),
    gamesPlayed: user.gamesPlayed + 1,
    wins: user.wins + (params.result === 'win' ? 1 : 0),
    losses: user.losses + (params.result === 'loss' ? 1 : 0),
    draws: user.draws + (params.result === 'draw' ? 1 : 0),
    ratingHistory: [
      ...user.ratingHistory,
      {
        date: new Date().toISOString().slice(0, 10),
        rating: newRating,
        opponent: params.opponentName,
        result: params.result,
        change
      }
    ]
  };

  saveCurrentUser(updatedUser);

  // Archive game
  const archivedGame: ArchivedGame = {
    id: `game-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    whitePlayer: params.playerColor === 'w' ? user.username : params.opponentName,
    blackPlayer: params.playerColor === 'b' ? user.username : params.opponentName,
    whiteElo: params.playerColor === 'w' ? user.rating : params.opponentElo,
    blackElo: params.playerColor === 'b' ? user.rating : params.opponentElo,
    result: params.result === 'win'
      ? (params.playerColor === 'w' ? '1-0' : '0-1')
      : params.result === 'loss'
      ? (params.playerColor === 'w' ? '0-1' : '1-0')
      : '1/2-1/2',
    reason: params.reason,
    pgn: params.pgn,
    movesCount: params.movesCount
  };

  try {
    const archive = getArchivedGames();
    archive.unshift(archivedGame);
    localStorage.setItem(STORAGE_KEY_ARCHIVE, JSON.stringify(archive.slice(0, 50)));
  } catch (e) {
    console.error('Failed to archive game:', e);
  }

  return { user: updatedUser, ratingChange: change };
}

export function getArchivedGames(): ArchivedGame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ARCHIVE);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load archive:', e);
  }
  return [];
}

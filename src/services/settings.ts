import { PieceSetType } from '../components/Board/PieceIcons';

export interface ChessSettings {
  soundEnabled: boolean;
  showLegalDots: boolean;
  showCoordinates: boolean;
  autoQueen: boolean;
  confirmMove: boolean;
  pieceSet: PieceSetType;
}

export const DEFAULT_SETTINGS: ChessSettings = {
  soundEnabled: true,
  showLegalDots: true,
  showCoordinates: true,
  autoQueen: false,
  confirmMove: false,
  pieceSet: 'cburnett'
};

const SETTINGS_STORAGE_KEY = 'chess_settings_v1';

export function loadSettings(): ChessSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    // Ignore error
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: ChessSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // Ignore error
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import { PUZZLES_COLLECTION } from '../src/components/Extras/PuzzleMode';
import { BOARD_THEMES } from '../src/constants/themes';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/services/settings';
import { loadStats, recordGameResult } from '../src/components/Extras/StatsTracker';

// Mock localStorage for node environment in tests
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => storage[k] || null,
  setItem: (k: string, v: string) => {
    storage[k] = String(v);
  },
  removeItem: (k: string) => {
    delete storage[k];
  },
  clear: () => {
    for (const k in storage) delete storage[k];
  }
};
(globalThis as any).localStorage = localStorageMock;

describe('Chess App Features and Integrations', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Tactical Puzzles Dataset Validity', () => {
    it('has valid FEN strings and legal solution moves for all curated puzzles', () => {
      expect(PUZZLES_COLLECTION.length).toBeGreaterThanOrEqual(6);

      PUZZLES_COLLECTION.forEach((puzzle) => {
        const chess = new Chess();
        expect(() => chess.load(puzzle.fen)).not.toThrow();

        // Verify solution UCI format (4 or 5 chars, e.g. "f3f7" or "e7e8q")
        expect(puzzle.solutionUci.length).toBeGreaterThanOrEqual(4);
        const from = puzzle.solutionUci.slice(0, 2);
        const to = puzzle.solutionUci.slice(2, 4);
        const promotion = puzzle.solutionUci[4];

        const moves = chess.moves({ verbose: true });
        const legalMatch = moves.find(
          (m) => m.from === from && m.to === to && (!promotion || m.promotion === promotion)
        );

        expect(
          legalMatch,
          `Puzzle ${puzzle.id} (${puzzle.title}): move ${puzzle.solutionUci} is not legal in FEN: ${puzzle.fen}`
        ).toBeDefined();

        // Make the move and ensure game state updates without crash
        const result = chess.move({ from, to, promotion: promotion as any });
        expect(result).not.toBeNull();
      });
    });

    it('categorizes puzzles across Beginner, Intermediate, and Advanced tiers', () => {
      const difficulties = PUZZLES_COLLECTION.map((p) => p.difficulty);
      expect(difficulties).toContain('Beginner');
      expect(difficulties).toContain('Intermediate');
      expect(difficulties).toContain('Advanced');
    });
  });

  describe('Board Themes Configuration', () => {
    it('provides at least 6 distinct curated color palettes with valid hex codes', () => {
      expect(BOARD_THEMES.length).toBeGreaterThanOrEqual(6);

      const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      BOARD_THEMES.forEach((theme) => {
        expect(theme.id).toBeTruthy();
        expect(theme.name).toBeTruthy();
        expect(theme.light).toMatch(hexRegex);
        expect(theme.dark).toMatch(hexRegex);
      });
    });

    it('includes Classic Wood, Forest Green, Ocean Blue, Slate Marble, and Amethyst', () => {
      const themeIds = BOARD_THEMES.map((t) => t.id);
      expect(themeIds).toContain('classic-wood');
      expect(themeIds).toContain('forest-green');
      expect(themeIds).toContain('ocean-blue');
      expect(themeIds).toContain('slate-marble');
      expect(themeIds).toContain('amethyst');
    });
  });

  describe('Settings Storage & Persistence', () => {
    it('loads default settings when localStorage is empty', () => {
      const s = loadSettings();
      expect(s.soundEnabled).toBe(true);
      expect(s.showLegalDots).toBe(true);
      expect(s.showCoordinates).toBe(true);
      expect(s.autoQueen).toBe(false);
      expect(s.confirmMove).toBe(false);
      expect(s.pieceSet).toBe('cburnett');
    });

    it('persists and retrieves modified settings in localStorage', () => {
      saveSettings({
        soundEnabled: false,
        showLegalDots: false,
        showCoordinates: false,
        autoQueen: true,
        confirmMove: true,
        pieceSet: 'modern'
      });

      const loaded = loadSettings();
      expect(loaded.soundEnabled).toBe(false);
      expect(loaded.showLegalDots).toBe(false);
      expect(loaded.showCoordinates).toBe(false);
      expect(loaded.autoQueen).toBe(true);
      expect(loaded.confirmMove).toBe(true);
      expect(loaded.pieceSet).toBe('modern');
    });
  });

  describe('Stats Tracker', () => {
    it('records and aggregates match results by skill level', () => {
      recordGameResult(5, 'win');
      recordGameResult(5, 'win');
      recordGameResult(5, 'loss');
      recordGameResult(8, 'draw');

      const stats = loadStats();
      expect(stats[5].played).toBe(3);
      expect(stats[5].won).toBe(2);
      expect(stats[5].lost).toBe(1);
      expect(stats[8].played).toBe(1);
      expect(stats[8].drawn).toBe(1);
    });
  });
});

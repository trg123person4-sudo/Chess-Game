import React from 'react';
import { Settings, Target, BarChart3, Palette } from 'lucide-react';

export type ActiveOverlay = 'none' | 'settings' | 'puzzles' | 'stats' | 'color';

interface FeatureToolbarProps {
  activeOverlay: ActiveOverlay;
  onToggleOverlay: (overlay: ActiveOverlay) => void;
  className?: string;
}

export const FeatureToolbar: React.FC<FeatureToolbarProps> = ({
  activeOverlay,
  onToggleOverlay,
  className = ''
}) => {
  const handleButtonClick = (target: ActiveOverlay) => {
    if (activeOverlay === target) {
      onToggleOverlay('none');
    } else {
      onToggleOverlay(target);
    }
  };

  return (
    <nav
      className={`feature-toolbar ${className}`}
      aria-label="Board features and settings toolbar"
    >
      {/* 1. Settings Button */}
      <button
        type="button"
        onClick={() => handleButtonClick('settings')}
        className={`feature-toolbar-btn ${activeOverlay === 'settings' ? 'active' : ''}`}
        aria-label="Game Settings"
        title="Settings (Sound, Coordinates, Piece Sets, Auto-Queen)"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* 2. Puzzles Button */}
      <button
        type="button"
        onClick={() => handleButtonClick('puzzles')}
        className={`feature-toolbar-btn ${activeOverlay === 'puzzles' ? 'active' : ''}`}
        aria-label="Tactical Puzzles"
        title="Tactical Puzzles (Find the best move)"
      >
        <Target className="w-4 h-4" />
      </button>

      {/* 3. Stats Button */}
      <button
        type="button"
        onClick={() => handleButtonClick('stats')}
        className={`feature-toolbar-btn ${activeOverlay === 'stats' ? 'active' : ''}`}
        aria-label="Performance Stats"
        title="Performance & Rating Stats"
      >
        <BarChart3 className="w-4 h-4" />
      </button>

      {/* 4. Board Color Swatches Button */}
      <button
        type="button"
        onClick={() => handleButtonClick('color')}
        className={`feature-toolbar-btn ${activeOverlay === 'color' ? 'active' : ''}`}
        aria-label="Board Color Palette"
        title="Change Board Color Palette"
      >
        <Palette className="w-4 h-4" />
      </button>
    </nav>
  );
};

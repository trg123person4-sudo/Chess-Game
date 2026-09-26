import React from 'react';
import { BOARD_THEMES } from '../../constants/themes';
import { Palette, X } from 'lucide-react';

interface ColorSwatchPopoverProps {
  currentThemeIndex: number;
  onSelectTheme: (index: number) => void;
  onClose: () => void;
}

export const ColorSwatchPopover: React.FC<ColorSwatchPopoverProps> = ({
  currentThemeIndex,
  onSelectTheme,
  onClose
}) => {
  return (
    <div className="swatch-popover-backdrop" onClick={onClose}>
      <div
        className="swatch-popover-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Color Swatches"
      >
        <div className="swatch-popover-header">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
            <Palette className="w-3.5 h-3.5" />
            <span>Board Palette</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="swatch-popover-close"
            aria-label="Close palette"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="swatch-grid">
          {BOARD_THEMES.map((theme, idx) => {
            const isSelected = idx === currentThemeIndex;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onSelectTheme(idx);
                }}
                className={`swatch-item-btn ${isSelected ? 'active' : ''}`}
                title={`Switch to ${theme.name}`}
              >
                <div className="swatch-chip">
                  <span className="swatch-half" style={{ backgroundColor: theme.light }} />
                  <span className="swatch-half" style={{ backgroundColor: theme.dark }} />
                </div>
                <span className="swatch-label">{theme.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

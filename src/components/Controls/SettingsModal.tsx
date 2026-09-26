import React from 'react';
import { ChessSettings } from '../../services/settings';
import { Settings, X, Volume2, VolumeX, Eye, EyeOff, Hash, Crown, CheckSquare, Layers } from 'lucide-react';
import { PieceSetType } from '../Board/PieceIcons';

interface SettingsModalProps {
  settings: ChessSettings;
  onUpdateSettings: (newSettings: Partial<ChessSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose
}) => {
  return (
    <div className="modal-backdrop-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Game Settings">
      <div className="modal-panel-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-panel-header">
          <div className="modal-panel-title">
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Settings</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-panel-close"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-panel-body">
          {/* 1. Piece Set Selector */}
          <div className="settings-item">
            <div className="settings-item-header">
              <div className="settings-item-label">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Piece Set</span>
              </div>
              <span className="settings-item-sub">
                {settings.pieceSet === 'cburnett' ? 'Classic (cburnett)' : 'Modern Minimal'}
              </span>
            </div>
            <div className="settings-toggle-grid">
              <button
                type="button"
                onClick={() => onUpdateSettings({ pieceSet: 'cburnett' })}
                className={`settings-toggle-btn ${settings.pieceSet === 'cburnett' ? 'active' : ''}`}
              >
                Classic (cburnett)
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ pieceSet: 'modern' })}
                className={`settings-toggle-btn ${settings.pieceSet === 'modern' ? 'active' : ''}`}
              >
                Modern Minimal
              </button>
            </div>
          </div>

          {/* 2. Sound Effects */}
          <div className="settings-item">
            <div className="settings-item-header">
              <div className="settings-item-label">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <span>Sound Effects</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`settings-switch ${settings.soundEnabled ? 'on' : 'off'}`}
                aria-label="Toggle sound"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>
            <span className="settings-item-desc">Audio on moves, captures, check, and game over</span>
          </div>

          {/* 3. Show Legal Move Dots */}
          <div className="settings-item">
            <div className="settings-item-header">
              <div className="settings-item-label">
                {settings.showLegalDots ? (
                  <Eye className="w-4 h-4 text-amber-500" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <span>Show Legal-Move Dots</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showLegalDots: !settings.showLegalDots })}
                className={`settings-switch ${settings.showLegalDots ? 'on' : 'off'}`}
                aria-label="Toggle legal move dots"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>
            <span className="settings-item-desc">Display target dots and capture rings when a piece is selected</span>
          </div>

          {/* 4. Show Board Coordinates */}
          <div className="settings-item">
            <div className="settings-item-header">
              <div className="settings-item-label">
                <Hash className="w-4 h-4 text-amber-500" />
                <span>Show Board Coordinates</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showCoordinates: !settings.showCoordinates })}
                className={`settings-switch ${settings.showCoordinates ? 'on' : 'off'}`}
                aria-label="Toggle coordinates"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>
            <span className="settings-item-desc">Show rank numbers (1–8) and file letters (a–h) along edges</span>
          </div>

          {/* 5. Auto-Queen on Promotion */}
          <div className="settings-item">
            <div className="settings-item-header">
              <div className="settings-item-label">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Auto-Queen on Promotion</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ autoQueen: !settings.autoQueen })}
                className={`settings-switch ${settings.autoQueen ? 'on' : 'off'}`}
                aria-label="Toggle auto queen"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>
            <span className="settings-item-desc">Automatically promote pawns to Queen without showing piece picker</span>
          </div>

          {/* 6. Move Confirmation */}
          <div className="settings-item">
            <div className="settings-item-header">
              <div className="settings-item-label">
                <CheckSquare className="w-4 h-4 text-amber-500" />
                <span>Move Confirmation</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ confirmMove: !settings.confirmMove })}
                className={`settings-switch ${settings.confirmMove ? 'on' : 'off'}`}
                aria-label="Toggle move confirmation"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>
            <span className="settings-item-desc">Prompt to confirm each move before sending to engine/opponent</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-panel-footer">
          <span className="settings-persisted-note">Settings auto-save to browser storage</span>
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

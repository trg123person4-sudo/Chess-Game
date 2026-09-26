import React, { useState } from 'react';
import { PieceColor } from '../../types/chess';
import { ClockControl, CLOCK_PRESETS } from '../../hooks/useChessClock';
import { getCurrentUser } from '../../services/ratings';
import { ProfileModal } from '../Profile/ProfileModal';

export type GameMode = 'bot' | 'multiplayer' | 'pass_and_play';

interface LobbyViewProps {
  onStartGame: (config: {
    mode: GameMode;
    gameId?: string;
    targetElo: number;
    playerColor: PieceColor;
    clockControl: ClockControl;
  }) => void;
}

const ELO_TIERS = [
  { elo: 400, label: '400', desc: 'Beginner' },
  { elo: 800, label: '800', desc: 'Casual' },
  { elo: 1200, label: '1200', desc: 'Club' },
  { elo: 1600, label: '1600', desc: 'Tournament' },
  { elo: 2000, label: '2000', desc: 'Expert' },
  { elo: 2800, label: '2800', desc: 'Master' }
];

export const LobbyView: React.FC<LobbyViewProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>('bot');
  const [selectedElo, setSelectedElo] = useState<number>(1200);
  const [selectedColor, setSelectedColor] = useState<PieceColor | 'random'>('w');
  const [selectedClockIndex, setSelectedClockIndex] = useState<number>(2); // 10 min default
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const [customGameId] = useState<string>(() => Math.random().toString(36).substring(2, 9));

  const currentUser = getCurrentUser();
  const activeTier = ELO_TIERS.find((t) => t.elo === selectedElo) || ELO_TIERS[2];

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?game=${customGameId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStart = () => {
    const resolvedColor: PieceColor =
      selectedColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : selectedColor;

    onStartGame({
      mode,
      gameId: mode === 'multiplayer' ? customGameId : undefined,
      targetElo: selectedElo,
      playerColor: resolvedColor,
      clockControl: CLOCK_PRESETS[selectedClockIndex]
    });
  };

  return (
    <div className="lobby-container">
      <header className="lobby-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="lobby-wordmark">Chess</h1>
        <button
          type="button"
          onClick={() => setShowProfile(true)}
          className="nav-link"
          style={{ fontSize: '12px' }}
        >
          {currentUser.username} ({currentUser.rating})
        </button>
      </header>

      <main className="lobby-main">
        {/* Game Mode Selector */}
        <section className="lobby-section">
          <div className="lobby-label-row">
            <span className="lobby-label">Mode</span>
          </div>

          <div className="lobby-choice-row" role="radiogroup" aria-label="Game mode">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'bot'}
              onClick={() => setMode('bot')}
              className={`lobby-choice-btn ${mode === 'bot' ? 'active' : ''}`}
            >
              vs Bot
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'multiplayer'}
              onClick={() => setMode('multiplayer')}
              className={`lobby-choice-btn ${mode === 'multiplayer' ? 'active' : ''}`}
            >
              vs Friend
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'pass_and_play'}
              onClick={() => setMode('pass_and_play')}
              className={`lobby-choice-btn ${mode === 'pass_and_play' ? 'active' : ''}`}
            >
              Pass & Play
            </button>
          </div>
        </section>

        {/* If vs Bot: Opponent Rating Selector */}
        {mode === 'bot' && (
          <section className="lobby-section">
            <div className="lobby-label-row">
              <span className="lobby-label">Opponent</span>
              <span className="lobby-caption">{activeTier.desc}</span>
            </div>

            <div className="lobby-tier-row" role="radiogroup" aria-label="Opponent rating">
              {ELO_TIERS.map((tier) => {
                const isSelected = tier.elo === selectedElo;
                return (
                  <button
                    key={tier.elo}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedElo(tier.elo)}
                    className={`lobby-tier-btn ${isSelected ? 'active' : ''}`}
                  >
                    <span className="lobby-tier-num">{tier.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* If vs Friend: Invite Link */}
        {mode === 'multiplayer' && (
          <section className="lobby-section">
            <div className="lobby-label-row">
              <span className="lobby-label">Private Invite Link</span>
              <span className="lobby-caption">Share with friend</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${window.location.pathname}?game=${customGameId}`}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--graphite-dim)',
                  color: 'var(--ink-secondary)',
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="lobby-choice-btn"
                style={{ border: '1px solid var(--graphite-dim)', padding: '8px 12px', fontSize: '12px' }}
              >
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>
        )}

        {/* Side / Color Choice */}
        <section className="lobby-section">
          <div className="lobby-label-row">
            <span className="lobby-label">Side</span>
          </div>

          <div className="lobby-choice-row" role="radiogroup" aria-label="Player piece color">
            <button
              type="button"
              role="radio"
              aria-checked={selectedColor === 'w'}
              onClick={() => setSelectedColor('w')}
              className={`lobby-choice-btn ${selectedColor === 'w' ? 'active' : ''}`}
            >
              White
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedColor === 'random'}
              onClick={() => setSelectedColor('random')}
              className={`lobby-choice-btn ${selectedColor === 'random' ? 'active' : ''}`}
            >
              Random
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedColor === 'b'}
              onClick={() => setSelectedColor('b')}
              className={`lobby-choice-btn ${selectedColor === 'b' ? 'active' : ''}`}
            >
              Black
            </button>
          </div>
        </section>

        {/* Time Control */}
        <section className="lobby-section">
          <div className="lobby-label-row">
            <span className="lobby-label">Clock</span>
          </div>

          <div
            className="lobby-clock-row"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            {CLOCK_PRESETS.slice(0, 4).map((preset, idx) => {
              const isSelected = idx === selectedClockIndex;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setSelectedClockIndex(idx)}
                  className={`lobby-clock-btn ${isSelected ? 'active' : ''}`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
          <div
            className="lobby-clock-row"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderTop: 'none' }}
          >
            {CLOCK_PRESETS.slice(4, 8).map((preset, offsetIdx) => {
              const idx = offsetIdx + 4;
              const isSelected = idx === selectedClockIndex;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setSelectedClockIndex(idx)}
                  className={`lobby-clock-btn ${isSelected ? 'active' : ''}`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Single Primary Action */}
        <div className="lobby-action-row">
          <button type="button" onClick={handleStart} className="lobby-start-btn">
            Start Game
          </button>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
};

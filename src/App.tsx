import React, { useState, useEffect, useRef } from 'react';
import { useChessGame } from './hooks/useChessGame';
import { useChessClock, formatTime, ClockControl } from './hooks/useChessClock';
import { ChessBoard } from './components/Board/ChessBoard';
import { MoveHistory } from './components/History/MoveHistory';
import { LobbyView, GameMode } from './components/Lobby/LobbyView';
import { ProfileModal } from './components/Profile/ProfileModal';
import { FeatureToolbar, ActiveOverlay } from './components/Controls/FeatureToolbar';
import { SettingsModal } from './components/Controls/SettingsModal';
import { PuzzleModeModal } from './components/Extras/PuzzleMode';
import { StatsModal } from './components/Extras/StatsTracker';
import { ColorSwatchPopover } from './components/Controls/ColorSwatchPopover';
import { PieceColor, PieceType } from './types/chess';
import { generatePGN } from './rules/pgn';
import { getCurrentUser } from './services/ratings';
import { BroadcastMultiplayerTransport, MultiplayerTransport } from './services/multiplayer';
import { BOARD_THEMES } from './constants/themes';
import { loadSettings, saveSettings, ChessSettings } from './services/settings';
import { sounds } from './audio/soundEffects';
import { Flag, RotateCcw, Palette } from 'lucide-react';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'lobby' | 'play'>('lobby');
  const [gameMode, setGameMode] = useState<GameMode>('bot');
  const [boardOrientation, setBoardOrientation] = useState<PieceColor>('w');
  const [currentElo, setCurrentElo] = useState<number>(1200);
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [drawOffered, setDrawOffered] = useState<boolean>(false);
  const [copiedPgn, setCopiedPgn] = useState<boolean>(false);
  const [themeIndex, setThemeIndex] = useState<number>(0);

  // Settings & Feature Overlays
  const [settings, setSettings] = useState<ChessSettings>(loadSettings);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('none');

  const transportRef = useRef<MultiplayerTransport | null>(null);

  const currentUser = getCurrentUser();

  const {
    game,
    playerColor,
    setPlayerColor,
    setTargetElo,
    moves,
    currentMoveIndex,
    lastMove,
    status,
    isSearching,
    makeMove,
    resetGame,
    goToMove,
    resign,
    offerDraw,
    abortGame,
    requestTakeback,
    lastRatingChange
  } = useChessGame({ playerColor: 'w', targetElo: 1200 });

  const {
    activeControl,
    whiteSeconds,
    blackSeconds,
    isWhiteLowTime,
    isBlackLowTime,
    resetClock,
    onMoveCompleted
  } = useChessClock(game.turn(), status.isOver);

  // Apply active board theme CSS custom properties
  useEffect(() => {
    const theme = BOARD_THEMES[themeIndex] || BOARD_THEMES[0];
    document.documentElement.style.setProperty('--sq-light', theme.light);
    document.documentElement.style.setProperty('--sq-dark', theme.dark);
  }, [themeIndex]);

  // Synchronize sound effects enabled state with settings
  useEffect(() => {
    sounds.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  const handleUpdateSettings = (updated: Partial<ChessSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updated };
      saveSettings(next);
      sounds.enabled = next.soundEnabled;
      return next;
    });
  };

  // Keyboard shortcut listener: Escape key closes any active overlay or profile modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveOverlay('none');
        setShowProfile(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check URL query parameters on initial load for invite link (?game=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    if (gameParam) {
      handleStartFromLobby({
        mode: 'multiplayer',
        gameId: gameParam,
        targetElo: 1200,
        playerColor: 'b', // Guest joining link plays Black by default
        clockControl: { name: 'Rapid (10+0)', initialMinutes: 10, incrementSeconds: 0 }
      });
    }
  }, []);

  // Real-time multiplayer synchronization
  useEffect(() => {
    if (gameMode !== 'multiplayer' || !transportRef.current) return;
    const transport = transportRef.current;

    transport.onMessage((msg) => {
      switch (msg.type) {
        case 'MOVE': {
          const { from, to, promotion } = msg.payload;
          const moved = makeMove(from, to, promotion);
          if (moved) {
            onMoveCompleted(game.turn());
          }
          break;
        }
        case 'DRAW_OFFER': {
          setDrawOffered(true);
          break;
        }
        case 'DRAW_RESPONSE': {
          if (msg.payload.accepted) {
            offerDraw();
          } else {
            alert('Your opponent declined the draw offer.');
          }
          break;
        }
        case 'RESIGN': {
          resign();
          break;
        }
        case 'ABORT': {
          abortGame();
          break;
        }
        case 'TAKEBACK_REQUEST': {
          if (confirm('Opponent requested a takeback. Allow?')) {
            requestTakeback();
            transport.send('TAKEBACK_RESPONSE', { accepted: true });
          } else {
            transport.send('TAKEBACK_RESPONSE', { accepted: false });
          }
          break;
        }
        case 'TAKEBACK_RESPONSE': {
          if (msg.payload.accepted) {
            requestTakeback();
          } else {
            alert('Takeback request declined.');
          }
          break;
        }
      }
    });
  }, [gameMode, makeMove, onMoveCompleted, game, offerDraw, resign, abortGame, requestTakeback]);

  const handleMakeMove = (from: string, to: string, promotion?: PieceType): boolean => {
    const moved = makeMove(from, to, promotion);
    if (moved) {
      onMoveCompleted(game.turn());
      if (gameMode === 'multiplayer' && transportRef.current) {
        transportRef.current.send('MOVE', { from, to, promotion });
      }
    }
    return moved;
  };

  const handleStartFromLobby = (config: {
    mode: GameMode;
    gameId?: string;
    targetElo: number;
    playerColor: PieceColor;
    clockControl: ClockControl;
  }) => {
    setGameMode(config.mode);
    setCurrentElo(config.targetElo);
    setTargetElo(config.targetElo);
    setPlayerColor(config.playerColor);
    setBoardOrientation(config.playerColor);
    resetClock(config.clockControl);
    resetGame();
    setDrawOffered(false);

    if (config.mode === 'multiplayer' && config.gameId) {
      if (transportRef.current) {
        transportRef.current.disconnect();
      }
      const transport = new BroadcastMultiplayerTransport();
      transport.connect(config.gameId, currentUser.id);
      transportRef.current = transport;
    }

    setCurrentScreen('play');
  };

  const handleNewGame = () => {
    resetGame();
    resetClock(activeControl);
    setDrawOffered(false);
  };

  const handleResign = () => {
    if (status.isOver) return;
    resign();
    if (gameMode === 'multiplayer' && transportRef.current) {
      transportRef.current.send('RESIGN');
    }
  };

  const handleOfferDraw = () => {
    if (status.isOver) return;
    if (gameMode === 'multiplayer' && transportRef.current) {
      transportRef.current.send('DRAW_OFFER');
      alert('Draw offer sent to opponent.');
    } else {
      offerDraw();
    }
  };

  const handleAcceptDraw = () => {
    setDrawOffered(false);
    offerDraw();
    if (gameMode === 'multiplayer' && transportRef.current) {
      transportRef.current.send('DRAW_RESPONSE', { accepted: true });
    }
  };

  const handleDeclineDraw = () => {
    setDrawOffered(false);
    if (gameMode === 'multiplayer' && transportRef.current) {
      transportRef.current.send('DRAW_RESPONSE', { accepted: false });
    }
  };

  const handleAbort = () => {
    if (moves.length >= 2 || status.isOver) return;
    abortGame();
    if (gameMode === 'multiplayer' && transportRef.current) {
      transportRef.current.send('ABORT');
    }
  };

  const handleTakeback = () => {
    if (moves.length === 0 || status.isOver) return;
    if (gameMode === 'multiplayer' && transportRef.current) {
      transportRef.current.send('TAKEBACK_REQUEST');
      alert('Takeback request sent to opponent.');
    } else {
      requestTakeback();
    }
  };

  const handleCopyCurrentPgn = () => {
    const pgn = generatePGN({
      event: gameMode === 'bot' ? `vs Stockfish (~${currentElo})` : 'Live Chess Match',
      white: playerColor === 'w' ? currentUser.username : (gameMode === 'bot' ? `Stockfish (~${currentElo})` : 'Opponent'),
      black: playerColor === 'b' ? currentUser.username : (gameMode === 'bot' ? `Stockfish (~${currentElo})` : 'Opponent'),
      result: status.winner === 'w' ? '1-0' : status.winner === 'b' ? '0-1' : status.winner === 'draw' ? '1/2-1/2' : '*',
      moves: moves.map((m) => m.san)
    });
    navigator.clipboard.writeText(pgn);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  const opponentColor: PieceColor = playerColor === 'w' ? 'b' : 'w';
  const topColor = boardOrientation === 'w' ? opponentColor : playerColor;
  const bottomColor = boardOrientation === 'w' ? playerColor : opponentColor;

  const topSeconds = topColor === 'w' ? whiteSeconds : blackSeconds;
  const bottomSeconds = bottomColor === 'w' ? whiteSeconds : blackSeconds;

  const isTopActive = game.turn() === topColor && !status.isOver;
  const isBottomActive = game.turn() === bottomColor && !status.isOver;

  const isTopLow = topColor === 'w' ? isWhiteLowTime : isBlackLowTime;
  const isBottomLow = bottomColor === 'w' ? isWhiteLowTime : isBlackLowTime;

  const getGameStatusText = () => {
    if (!status.isOver) return null;
    if (status.reason === 'aborted') {
      return 'Game aborted.';
    }
    if (status.reason === 'checkmate') {
      return `${status.winner === 'w' ? 'White' : 'Black'} won by checkmate.`;
    }
    if (status.reason === 'resignation') {
      return `${status.winner === 'w' ? 'White' : 'Black'} won by resignation.`;
    }
    if (status.reason === 'timeout') {
      return `${status.winner === 'w' ? 'White' : 'Black'} won on time.`;
    }
    if (status.reason === 'draw_agreement') {
      return 'Game drawn by agreement.';
    }
    if (status.reason === 'stalemate') {
      return 'Draw by stalemate.';
    }
    if (status.reason === 'threefold_repetition') {
      return 'Draw by repetition.';
    }
    if (status.reason === 'insufficient_material') {
      return 'Draw by insufficient material.';
    }
    return status.winner === 'draw'
      ? 'Game drawn.'
      : `${status.winner === 'w' ? 'White' : 'Black'} won.`;
  };

  if (currentScreen === 'lobby') {
    return <LobbyView onStartGame={handleStartFromLobby} />;
  }

  return (
    <div className="play-shell">
      {/* Top Header */}
      <header className="play-header">
        <h1 className="lobby-wordmark">Chess</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Top-Right Feature Toolbar (Settings, Puzzles, Stats, Palette) */}
          <FeatureToolbar
            activeOverlay={activeOverlay}
            onToggleOverlay={setActiveOverlay}
          />

          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="nav-link"
            style={{ fontSize: '12px' }}
          >
            {currentUser.username} ({currentUser.rating})
          </button>
          <button
            type="button"
            onClick={() => {
              if (transportRef.current) transportRef.current.disconnect();
              setCurrentScreen('lobby');
            }}
            className="nav-link"
          >
            Lobby
          </button>
        </div>
      </header>

      {/* Main play layout: Board column + Scoresheet column */}
      <main className="play-main">
        {/* Left Column: Board and Player Rows */}
        <div className="board-column">
          {/* Top Player (Opponent) */}
          <div className="player-row">
            <div className="player-meta">
              <span className="player-name">
                {gameMode === 'bot'
                  ? 'Stockfish Bot'
                  : gameMode === 'pass_and_play'
                  ? (topColor === 'w' ? 'White' : 'Black')
                  : 'Opponent'}
              </span>
              {gameMode === 'bot' && <span className="player-rating">{currentElo}</span>}
            </div>
            {activeControl.initialMinutes > 0 && (
              <span
                className={`player-clock ${isTopActive ? 'active' : ''} ${isTopLow ? 'low' : ''}`}
              >
                {formatTime(topSeconds)}
              </span>
            )}
          </div>

          {/* Chess Board */}
          <ChessBoard
            game={game}
            orientation={boardOrientation}
            lastMove={lastMove}
            disabled={status.isOver || (gameMode === 'bot' && isSearching)}
            showCoordinates={settings.showCoordinates}
            showLegalDots={settings.showLegalDots}
            autoQueen={settings.autoQueen}
            confirmMove={settings.confirmMove}
            pieceSet={settings.pieceSet}
            onMove={handleMakeMove}
          />

          {/* Bottom Player (You) */}
          <div className="player-row">
            <div className="player-meta">
              <span className="player-name">
                {gameMode === 'pass_and_play'
                  ? (bottomColor === 'w' ? 'White' : 'Black')
                  : currentUser.username}
              </span>
              {lastRatingChange !== null && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: lastRatingChange >= 0 ? '#10b981' : '#ef4444'
                  }}
                >
                  {lastRatingChange >= 0 ? `+${lastRatingChange}` : lastRatingChange}
                </span>
              )}
            </div>
            {activeControl.initialMinutes > 0 && (
              <span
                className={`player-clock ${isBottomActive ? 'active' : ''} ${isBottomLow ? 'low' : ''}`}
              >
                {formatTime(bottomSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Clean Scoresheet & In-game Actions */}
        <div className="scoresheet-column">
          <MoveHistory
            moves={moves}
            currentMoveIndex={currentMoveIndex}
            onSelectMove={(idx) => goToMove(idx)}
          />

          {/* Draw offer banner */}
          {drawOffered && !status.isOver && (
            <div
              style={{
                padding: '8px 0',
                borderTop: '1px solid var(--graphite-dim)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--accent)' }}>Draw offered</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAcceptDraw}
                  className="action-btn"
                  style={{ color: 'var(--accent)' }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handleDeclineDraw}
                  className="action-btn"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Game Over status */}
          {status.isOver && (
            <div className="game-status-notice">
              <div>{getGameStatusText()}</div>
              {lastRatingChange !== null && (
                <div style={{ fontSize: '11px', color: 'var(--graphite)', marginTop: '4px' }}>
                  Rating adjusted by{' '}
                  <strong style={{ color: lastRatingChange >= 0 ? '#10b981' : '#ef4444' }}>
                    {lastRatingChange >= 0 ? `+${lastRatingChange}` : lastRatingChange}
                  </strong>{' '}
                  (New rating: {currentUser.rating})
                </div>
              )}
            </div>
          )}

          {/* Actions toolbar */}
          <div className="scoresheet-actions" style={{ flexWrap: 'wrap', gap: '12px' }}>
            {moves.length < 2 && !status.isOver ? (
              <button
                type="button"
                onClick={handleAbort}
                className="action-btn"
                title="Abort Game (before move 2)"
              >
                <span>Abort</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResign}
                disabled={status.isOver || isSearching}
                className="action-btn resign"
                title="Resign"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Resign</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOfferDraw}
              disabled={status.isOver || isSearching}
              className="action-btn"
              title="Offer Draw"
            >
              <span>Draw</span>
            </button>

            {moves.length > 0 && !status.isOver && (
              <button
                type="button"
                onClick={handleTakeback}
                className="action-btn"
                title="Request Takeback"
              >
                <span>Takeback</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveOverlay((prev) => (prev === 'color' ? 'none' : 'color'))}
              className="action-btn"
              title="Change board color"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Color</span>
            </button>

            <button
              type="button"
              onClick={() => setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'))}
              className="action-btn"
              title="Flip Board Orientation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Flip</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCurrentPgn}
              className="action-btn"
              title="Copy PGN to clipboard"
            >
              <span>{copiedPgn ? 'Copied' : 'PGN'}</span>
            </button>

            <button
              type="button"
              onClick={handleNewGame}
              className="action-btn"
              title="New Game"
            >
              <span>{status.isOver ? 'Rematch' : 'New Game'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Feature Overlays (Rendered safely on top of active match without disturbing state or clocks) */}
      {activeOverlay === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setActiveOverlay('none')}
        />
      )}

      {activeOverlay === 'puzzles' && (
        <PuzzleModeModal
          playerRating={currentUser.rating}
          pieceSet={settings.pieceSet}
          onClose={() => setActiveOverlay('none')}
        />
      )}

      {activeOverlay === 'stats' && (
        <StatsModal onClose={() => setActiveOverlay('none')} />
      )}

      {activeOverlay === 'color' && (
        <ColorSwatchPopover
          currentThemeIndex={themeIndex}
          onSelectTheme={(idx) => {
            setThemeIndex(idx);
            setActiveOverlay('none');
          }}
          onClose={() => setActiveOverlay('none')}
        />
      )}

      {/* User Profile Modal */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
};

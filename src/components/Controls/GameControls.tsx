import React from 'react';
import { RotateCcw, Flag, Handshake, RefreshCw, Volume2, VolumeX, FileCode } from 'lucide-react';
import { sounds } from '../../audio/soundEffects';

interface GameControlsProps {
  onNewGame: () => void;
  onUndo: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onFlipBoard: () => void;
  onOpenPgnFen: () => void;
  canUndo: boolean;
  isGameOver: boolean;
  isEngineThinking: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onUndo,
  onResign,
  onOfferDraw,
  onFlipBoard,
  onOpenPgnFen,
  canUndo,
  isGameOver,
  isEngineThinking
}) => {
  const [soundEnabled, setSoundEnabled] = React.useState(sounds.enabled);

  const toggleSound = () => {
    sounds.enabled = !sounds.enabled;
    setSoundEnabled(sounds.enabled);
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 shadow-lg flex flex-col gap-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={onNewGame}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-medium text-xs rounded-lg transition-all shadow-md cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>New Game</span>
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo || isEngineThinking}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:pointer-events-none active:scale-95 text-slate-200 font-medium text-xs rounded-lg transition-all cursor-pointer"
          title="Take back move"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>

        <button
          onClick={onOfferDraw}
          disabled={isGameOver || isEngineThinking}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:pointer-events-none active:scale-95 text-slate-200 font-medium text-xs rounded-lg transition-all cursor-pointer"
          title="Offer a draw to the engine"
        >
          <Handshake className="w-3.5 h-3.5 text-amber-400" />
          <span>Draw</span>
        </button>

        <button
          onClick={onResign}
          disabled={isGameOver || isEngineThinking}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/50 disabled:opacity-40 disabled:pointer-events-none active:scale-95 text-rose-300 font-medium text-xs rounded-lg transition-all cursor-pointer"
          title="Resign current game"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Resign</span>
        </button>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
        <button
          onClick={onFlipBoard}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 px-2 rounded cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Flip Board</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPgnFen}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 px-2 rounded cursor-pointer"
            title="Import or Export FEN / PGN"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>FEN / PGN</span>
          </button>

          <button
            onClick={toggleSound}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

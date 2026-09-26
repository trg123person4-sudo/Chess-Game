import React from 'react';
import { formatTime, ClockControl, CLOCK_PRESETS } from '../../hooks/useChessClock';
import { Clock } from 'lucide-react';

interface ClockDisplayProps {
  whiteSeconds: number;
  blackSeconds: number;
  activeTurn: 'w' | 'b';
  activeControl: ClockControl;
  onSelectControl: (ctrl: ClockControl) => void;
  disabled?: boolean;
}

export const ClockDisplay: React.FC<ClockDisplayProps> = ({
  whiteSeconds,
  blackSeconds,
  activeTurn,
  activeControl,
  onSelectControl,
  disabled = false
}) => {
  if (activeControl.initialMinutes === 0) {
    return (
      <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>Clock: Unlimited</span>
        </div>
        <select
          disabled={disabled}
          value={activeControl.name}
          onChange={(e) => {
            const found = CLOCK_PRESETS.find((p) => p.name === e.target.value);
            if (found) onSelectControl(found);
          }}
          className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none cursor-pointer"
        >
          {CLOCK_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const whiteLow = whiteSeconds < 30;
  const blackLow = blackSeconds < 30;

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 shadow-lg flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="font-medium text-slate-300">{activeControl.name}</span>
        </div>
        <select
          disabled={disabled}
          value={activeControl.name}
          onChange={(e) => {
            const found = CLOCK_PRESETS.find((p) => p.name === e.target.value);
            if (found) onSelectControl(found);
          }}
          className="bg-slate-900 border border-slate-700 text-[11px] text-slate-300 rounded px-2 py-0.5 outline-none cursor-pointer"
        >
          {CLOCK_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* White Clock */}
        <div
          className={`flex flex-col items-center py-2 px-3 rounded-lg border transition-all ${
            activeTurn === 'w'
              ? 'bg-slate-700/80 border-amber-400/80 shadow-md ring-1 ring-amber-400/30'
              : 'bg-slate-900/60 border-slate-700/50 opacity-80'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400">White</span>
          <span
            className={`font-mono text-xl font-bold tracking-wider ${
              whiteLow ? 'text-red-400 animate-pulse' : 'text-slate-100'
            }`}
          >
            {formatTime(whiteSeconds)}
          </span>
        </div>

        {/* Black Clock */}
        <div
          className={`flex flex-col items-center py-2 px-3 rounded-lg border transition-all ${
            activeTurn === 'b'
              ? 'bg-slate-700/80 border-amber-400/80 shadow-md ring-1 ring-amber-400/30'
              : 'bg-slate-900/60 border-slate-700/50 opacity-80'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400">Black</span>
          <span
            className={`font-mono text-xl font-bold tracking-wider ${
              blackLow ? 'text-red-400 animate-pulse' : 'text-slate-100'
            }`}
          >
            {formatTime(blackSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
};

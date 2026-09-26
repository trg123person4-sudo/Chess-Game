import React from 'react';
import { SKILL_LEVELS, getSkillConfigForElo } from '../../engine/skillLevels';
import { Brain, Cpu, ShieldAlert, BookOpen, Sliders } from 'lucide-react';

interface SkillSelectorProps {
  currentLevel: number;
  onSelectLevel: (level: number) => void;
  targetElo?: number;
  onSelectElo?: (elo: number) => void;
  disabled?: boolean;
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  currentLevel,
  onSelectLevel,
  targetElo,
  onSelectElo,
  disabled = false
}) => {
  const activeSkill = targetElo
    ? getSkillConfigForElo(targetElo)
    : (SKILL_LEVELS.find((l) => l.id === currentLevel) || SKILL_LEVELS[4]);

  const activeElo = targetElo || activeSkill.eloEstimate;

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      {/* Header & Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-sm text-slate-200">Stockfish Elo Calibration</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-full text-xs font-mono font-medium text-amber-200">
          <span className="font-bold text-amber-300">~{activeElo} Elo</span>
          <span className="text-amber-600">•</span>
          <span>Lvl {activeSkill.id}</span>
        </div>
      </div>

      {/* Level Slider (1 - 10) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="font-medium text-slate-200">{activeSkill.name}</span>
          <span className="text-[11px] text-amber-300 font-mono">
            {activeElo < 1320 ? 'Weakened Sub-1320 Layer' : 'Stockfish Native UCI_Elo'}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={activeSkill.id}
          disabled={disabled}
          onChange={(e) => {
            const lvl = parseInt(e.target.value, 10);
            onSelectLevel(lvl);
            if (onSelectElo) {
              const matched = SKILL_LEVELS.find((l) => l.id === lvl);
              if (matched) onSelectElo(matched.eloEstimate);
            }
          }}
          className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>1: 400 Elo</span>
          <span>3: 800</span>
          <span>5: 1200</span>
          <span>6: 1320 Base</span>
          <span>8: 2000</span>
          <span>10: 2800+ GM</span>
        </div>
      </div>

      {/* Live Calibration Parameters Grid */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          <span>Stockfish UCI:</span>
          <strong className="text-amber-300 font-mono">
            {activeElo < 1320 ? `1320 (Clamped)` : `${activeSkill.uciElo}`}
          </strong>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Search Depth:</span>
          <strong className="text-slate-100 font-mono">
            {activeSkill.maxDepth > 0 ? `Depth ${activeSkill.maxDepth}` : 'Deep / Full'}
          </strong>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>Blunder Rate:</span>
          <strong className={`font-mono ${activeSkill.blunderProbability > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {(activeSkill.blunderProbability * 100).toFixed(0)}%
          </strong>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>Opening Book:</span>
          <strong className="text-cyan-300 font-mono">
            {activeSkill.maxBookPlies === 0 ? 'Skipped (Move 1)' : `${activeSkill.maxBookPlies} Plies`}
          </strong>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed italic bg-slate-900/40 p-2 rounded border border-slate-700/40">
        "{activeSkill.description}"
      </p>
    </div>
  );
};

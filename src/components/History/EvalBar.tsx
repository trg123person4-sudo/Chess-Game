import React from 'react';

interface EvalBarProps {
  score: number; // centipawns (from White's perspective)
  inCheck?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({ score }) => {
  let whitePercent = 50;
  let text = '0.0';

  if (score > 15000) {
    whitePercent = 100;
    text = '+M';
  } else if (score < -15000) {
    whitePercent = 0;
    text = '-M';
  } else {
    const winRate = 1 / (1 + Math.pow(10, -score / 400));
    whitePercent = Math.min(97, Math.max(3, winRate * 100));
    const pawns = (score / 100).toFixed(1);
    text = score > 0 ? `+${pawns}` : pawns;
  }

  return (
    <div className="eval-bar-wrapper">
      <div
        className="eval-bar-white"
        style={{ height: `${whitePercent}%` }}
      />
      <span
        className="eval-bar-label"
        style={{ color: whitePercent > 50 ? '#0f172a' : '#f8fafc' }}
      >
        {text}
      </span>
    </div>
  );
};

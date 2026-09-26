import React, { useEffect, useRef } from 'react';
import { MoveRecord } from '../../types/chess';

interface MoveHistoryProps {
  moves: MoveRecord[];
  currentMoveIndex: number;
  onSelectMove: (index: number) => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  moves,
  currentMoveIndex,
  onSelectMove
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Pair moves into rounds: [White, Black]
  const rounds: {
    round: number;
    white?: MoveRecord;
    whiteIdx?: number;
    black?: MoveRecord;
    blackIdx?: number;
  }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    rounds.push({
      round: Math.floor(i / 2) + 1,
      white: moves[i],
      whiteIdx: i,
      black: moves[i + 1],
      blackIdx: i + 1 < moves.length ? i + 1 : undefined
    });
  }

  return (
    <div className="scoresheet-container">
      <div className="scoresheet-header">
        <span className="scoresheet-col-num">#</span>
        <span className="scoresheet-col-move">White</span>
        <span className="scoresheet-col-move">Black</span>
      </div>

      <div ref={scrollRef} className="scoresheet-body">
        {rounds.length === 0 ? (
          <div className="scoresheet-empty">Moves will record here</div>
        ) : (
          rounds.map((r) => {
            const isWhiteActive = currentMoveIndex === r.whiteIdx;
            const isBlackActive = r.blackIdx !== undefined && currentMoveIndex === r.blackIdx;

            return (
              <div key={r.round} className="scoresheet-row">
                <span className="scoresheet-num">{r.round}.</span>

                {/* White Move */}
                <button
                  type="button"
                  onClick={() => r.whiteIdx !== undefined && onSelectMove(r.whiteIdx)}
                  className={`scoresheet-move ${isWhiteActive ? 'active' : ''}`}
                >
                  {r.white ? r.white.san : ''}
                </button>

                {/* Black Move */}
                {r.black && r.blackIdx !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onSelectMove(r.blackIdx!)}
                    className={`scoresheet-move ${isBlackActive ? 'active' : ''}`}
                  >
                    {r.black.san}
                  </button>
                ) : (
                  <span className="scoresheet-move-empty" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

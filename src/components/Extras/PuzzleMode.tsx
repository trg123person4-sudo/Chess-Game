import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Target, X, HelpCircle, RotateCcw, ArrowRight, Flame, Trophy, CheckCircle2, AlertCircle } from 'lucide-react';
import { PieceIcon, PieceSetType } from '../Board/PieceIcons';
import { PieceColor, Square as ChessSquare } from '../../types/chess';

export interface TacticalPuzzle {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  minRating: number;
  maxRating: number;
  fen: string;
  solutionUci: string; // e.g. "f3f7"
  hint: string;
  explanation: string;
}

export const PUZZLES_COLLECTION: TacticalPuzzle[] = [
  // Beginner (<1000)
  {
    id: 'b1',
    title: "Scholar's Punish",
    difficulty: 'Beginner',
    minRating: 400,
    maxRating: 1000,
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B5/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
    solutionUci: 'f3f7',
    hint: 'Target the weak, undefended f7 square with Queen & Bishop.',
    explanation: '1. Qxf7# delivers an immediate checkmate supported by the bishop on c4.'
  },
  {
    id: 'b2',
    title: 'Back-Rank Penetration',
    difficulty: 'Beginner',
    minRating: 400,
    maxRating: 1000,
    fen: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
    solutionUci: 'd1d8',
    hint: 'The black king has no escape square because of its pawn shield.',
    explanation: '1. Rd8# delivers back-rank mate.'
  },
  {
    id: 'b3',
    title: 'Free Queen Blunder',
    difficulty: 'Beginner',
    minRating: 400,
    maxRating: 1000,
    fen: 'rnb1kbnr/pppp1ppp/8/4q3/4PB2/8/PPP2PPP/RN1QKB1R w KQkq - 0 1',
    solutionUci: 'f4e5',
    hint: 'Look for Black pieces left completely unguarded in the center.',
    explanation: '1. Bxe5 captures Black’s queen for free.'
  },

  // Intermediate (1000 - 1500)
  {
    id: 'i1',
    title: 'Smothered Back-Rank Net',
    difficulty: 'Intermediate',
    minRating: 1000,
    maxRating: 1500,
    fen: '6k1/5ppp/8/8/5N2/8/8/4R1K1 w - - 0 1',
    solutionUci: 'e1e8',
    hint: 'The knight covers g7 and h8 escapes while the rook strikes the 8th rank.',
    explanation: '1. Re8# delivers checkmate with back-rank coordination.'
  },
  {
    id: 'i2',
    title: 'Rook Cutoff & Cornering',
    difficulty: 'Intermediate',
    minRating: 1000,
    maxRating: 1500,
    fen: 'k7/8/PK6/8/8/8/8/1R6 w - - 0 1',
    solutionUci: 'b1e1',
    hint: 'Shift your rook to the open file to prepare an inescapable checkmate.',
    explanation: '1. Re1 forces Black to 1...Kb8, enabling 2. Re8# next move.'
  },
  {
    id: 'i3',
    title: 'Royal Fork',
    difficulty: 'Intermediate',
    minRating: 1000,
    maxRating: 1500,
    fen: 'r3k2r/ppp2ppp/8/3N4/8/8/PPPP1PPP/R1B1K2R w KQkq - 0 1',
    solutionUci: 'd5c7',
    hint: 'Jump the knight to attack both the King and the corner Rook simultaneously.',
    explanation: '1. Nxc7+ forks King on e8 and Rook on a8.'
  },

  // Advanced (1500+)
  {
    id: 'a1',
    title: 'Classic Greek Gift',
    difficulty: 'Advanced',
    minRating: 1500,
    maxRating: 2800,
    fen: 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 7',
    solutionUci: 'd3h7',
    hint: 'Sacrifice the bishop on h7 to shatter Black’s castled king shelter.',
    explanation: '1. Bxh7+ Kxh7 initiates a devastating kingside attack.'
  },
  {
    id: 'a2',
    title: 'Double Attack Pin',
    difficulty: 'Advanced',
    minRating: 1500,
    maxRating: 2800,
    fen: 'r1b1k2r/pppq1ppp/2n5/1B1pP3/1b1P4/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 1',
    solutionUci: 'e1g1',
    hint: 'Safety first: castle your king out of the center and unleash your rook.',
    explanation: '1. O-O unpins your knight and prepares active center play.'
  }
];

const PUZZLE_STREAK_KEY = 'chess_puzzle_streak_v1';

function getStoredStreak(): { current: number; best: number } {
  try {
    const raw = localStorage.getItem(PUZZLE_STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { current: 0, best: 0 };
}

function saveStoredStreak(streak: { current: number; best: number }) {
  try {
    localStorage.setItem(PUZZLE_STREAK_KEY, JSON.stringify(streak));
  } catch (e) {}
}

interface PuzzleModeProps {
  playerRating?: number;
  pieceSet?: PieceSetType;
  onClose: () => void;
}

export const PuzzleModeModal: React.FC<PuzzleModeProps> = ({
  playerRating = 1200,
  pieceSet = 'cburnett',
  onClose
}) => {
  // Filter puzzles matched to rating
  const matchingPuzzles = PUZZLES_COLLECTION.filter(
    (p) => playerRating >= p.minRating - 200 && playerRating <= p.maxRating + 200
  );
  const activePool = matchingPuzzles.length > 0 ? matchingPuzzles : PUZZLES_COLLECTION;

  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [streak, setStreak] = useState(getStoredStreak());
  const [puzzleGame, setPuzzleGame] = useState<Chess>(() => new Chess(activePool[0].fen));
  const [selectedSquare, setSelectedSquare] = useState<ChessSquare | null>(null);
  const [statusState, setStatusState] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [showHint, setShowHint] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  const currentPuzzle = activePool[puzzleIndex % activePool.length];

  // Reload puzzle position whenever index changes
  useEffect(() => {
    const newGame = new Chess(currentPuzzle.fen);
    setPuzzleGame(newGame);
    setSelectedSquare(null);
    setStatusState('playing');
    setShowHint(false);
    setAnimationClass('');
  }, [puzzleIndex, currentPuzzle.fen]);

  const handleSquareClick = (square: ChessSquare) => {
    if (statusState === 'correct') return;

    if (!selectedSquare) {
      const piece = puzzleGame.get(square);
      if (piece && piece.color === puzzleGame.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const targetPiece = puzzleGame.get(square);
    if (targetPiece && targetPiece.color === puzzleGame.turn()) {
      setSelectedSquare(square);
      return;
    }

    // Try making the move
    const from = selectedSquare;
    const to = square;
    const attemptedUci = `${from}${to}`;

    const moves = puzzleGame.moves({ square: from as any, verbose: true });
    const isLegal = moves.some((m) => m.to === to);

    if (!isLegal) {
      setSelectedSquare(null);
      return;
    }

    // Execute move on the test chess instance
    const moveResult = puzzleGame.move({ from, to, promotion: 'q' });
    if (!moveResult) {
      setSelectedSquare(null);
      return;
    }

    // Check if it matches expected solution
    if (attemptedUci === currentPuzzle.solutionUci) {
      // Correct!
      setStatusState('correct');
      setAnimationClass('puzzle-flash-correct');
      const newCurrent = streak.current + 1;
      const newBest = Math.max(streak.best, newCurrent);
      const updated = { current: newCurrent, best: newBest };
      setStreak(updated);
      saveStoredStreak(updated);
    } else {
      // Wrong move!
      setStatusState('wrong');
      setAnimationClass('puzzle-shake-wrong');
      const updated = { current: 0, best: streak.best };
      setStreak(updated);
      saveStoredStreak(updated);
    }

    setSelectedSquare(null);
  };

  const handleRetry = () => {
    setPuzzleGame(new Chess(currentPuzzle.fen));
    setStatusState('playing');
    setSelectedSquare(null);
    setAnimationClass('');
  };

  const handleNextPuzzle = () => {
    setPuzzleIndex((prev) => prev + 1);
  };

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  return (
    <div className="modal-backdrop-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Tactical Puzzles">
      <div
        className={`puzzle-modal-card ${animationClass}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '100%' }}
      >
        {/* Header */}
        <div className="modal-panel-header">
          <div className="modal-panel-title">
            <Target className="w-4 h-4 text-amber-500" />
            <span>Tactical Puzzles</span>
            <span className="puzzle-difficulty-tag">{currentPuzzle.difficulty}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="puzzle-streak-pill" title="Current streak / Best streak">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>{streak.current}</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>{streak.best}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="modal-panel-close"
              aria-label="Close puzzles"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Puzzle Subheader */}
        <div className="puzzle-meta-bar">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
              {currentPuzzle.title}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--graphite)' }}>
              Rating tier ~{playerRating} • White to move
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowHint((prev) => !prev)}
            className="action-btn"
            style={{ fontSize: '11px', color: showHint ? 'var(--accent)' : 'var(--graphite)' }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Hide Hint' : 'Hint'}</span>
          </button>
        </div>

        {/* Hint Box */}
        {showHint && (
          <div className="puzzle-hint-callout">
            <span style={{ fontWeight: 600 }}>Hint: </span>
            <span>{currentPuzzle.hint}</span>
          </div>
        )}

        {/* Interactive Puzzle Board */}
        <div className="puzzle-board-wrapper">
          <div className="puzzle-board-grid">
            {ranks.map((rank) =>
              files.map((file) => {
                const square = `${file}${rank}` as ChessSquare;
                const piece = puzzleGame.get(square);
                const fileNum = file.charCodeAt(0) - 'a'.charCodeAt(0);
                const rankNum = parseInt(rank, 10);
                const isLight = (fileNum + rankNum) % 2 !== 0;
                const isSelected = selectedSquare === square;

                return (
                  <div
                    key={square}
                    onClick={() => handleSquareClick(square)}
                    className={`puzzle-square ${isLight ? 'square-light' : 'square-dark'} ${
                      isSelected ? 'square-highlight-selected' : ''
                    }`}
                  >
                    {piece && (
                      <div className="piece-container">
                        <PieceIcon type={piece.type} color={piece.color} set={pieceSet} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Feedback Bar */}
        <div className="puzzle-feedback-bar">
          {statusState === 'playing' && (
            <span className="puzzle-status-text">Find the best winning move...</span>
          )}

          {statusState === 'correct' && (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Correct! {currentPuzzle.explanation}</span>
            </div>
          )}

          {statusState === 'wrong' && (
            <div className="flex items-center gap-1.5 text-rose-400 font-medium text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>That move is not optimal. Try another line!</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="modal-panel-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={handleRetry}
            className="action-btn"
            title="Reset position and try again"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>

          <button
            type="button"
            onClick={handleNextPuzzle}
            className="action-btn"
            style={{
              color: statusState === 'correct' ? '#121213' : 'var(--ink)',
              backgroundColor: statusState === 'correct' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
              padding: '6px 14px'
            }}
          >
            <span>Next Puzzle</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

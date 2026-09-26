import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { PieceColor, PieceType, MoveRecord, GameStatus, GameTermination } from '../types/chess';
import { useEngineWorker, EngineStats } from './useEngineWorker';
import { sounds } from '../audio/soundEffects';
import { recordGameResult } from '../components/Extras/StatsTracker';
import { getSkillLevel } from '../engine/skillLevels';
import { recordRatedMatch, getCurrentUser } from '../services/ratings';
import { generatePGN } from '../rules/pgn';
import { calculateMoveTime } from '../engine/calculateMoveTime';

const SAVE_KEY = 'chess_engine_saved_game_v1';

export interface UseChessGameOptions {
  playerColor?: PieceColor;
  skillLevel?: number;
  targetElo?: number;
  personality?: 'balanced' | 'aggressive' | 'positional';
}

export function useChessGame(options: UseChessGameOptions = {}) {
  const [playerColor, setPlayerColor] = useState<PieceColor>(options.playerColor || 'w');
  const [skillLevel, setSkillLevelState] = useState<number>(options.skillLevel || 5);
  const [targetElo, setTargetElo] = useState<number>(
    options.targetElo || getSkillLevel(options.skillLevel || 5).eloEstimate
  );

  const setSkillLevel = useCallback((lvl: number) => {
    setSkillLevelState(lvl);
    setTargetElo(getSkillLevel(lvl).eloEstimate);
  }, []);
  const [personality, setPersonality] = useState<'balanced' | 'aggressive' | 'positional'>(
    options.personality || 'balanced'
  );

  const [game, setGame] = useState<Chess>(() => new Chess());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [evalScore, setEvalScore] = useState<number>(0); // From white perspective
  const [status, setStatus] = useState<GameStatus>({
    isOver: false,
    winner: null,
    reason: null,
    inCheck: false
  });
  const [lastRatingChange, setLastRatingChange] = useState<number | null>(null);
  const [isDelaying, setIsDelaying] = useState<boolean>(false);
  const engineSearchStartTimeRef = useRef<number>(0);
  const delayTimeoutRef = useRef<number | null>(null);

  const handleGameEndRecord = useCallback(
    (winner: PieceColor | 'draw' | null, reason: GameTermination, currentMoves: MoveRecord[]) => {
      if (reason === 'aborted') {
        setLastRatingChange(null);
        return;
      }
      const isWin = winner === playerColor;
      const isDraw = winner === 'draw';
      const outcome = isWin ? 'win' : isDraw ? 'draw' : 'loss';

      const pgn = generatePGN({
        event: 'Rated Bot Game',
        white: playerColor === 'w' ? getCurrentUser().username : `Stockfish (~${targetElo})`,
        black: playerColor === 'b' ? getCurrentUser().username : `Stockfish (~${targetElo})`,
        result: isWin ? (playerColor === 'w' ? '1-0' : '0-1') : isDraw ? '1/2-1/2' : (playerColor === 'w' ? '0-1' : '1-0'),
        moves: currentMoves.map((m) => m.san)
      });

      const { ratingChange } = recordRatedMatch({
        opponentName: `Stockfish (~${targetElo})`,
        opponentElo: targetElo,
        result: outcome,
        reason: reason || 'unknown',
        pgn,
        playerColor,
        movesCount: currentMoves.length
      });

      setLastRatingChange(ratingChange);
    },
    [playerColor, targetElo]
  );

  const checkAndSetGameStatus = useCallback(
    (g: Chess, overrideMoves?: MoveRecord[]): GameStatus => {
      const inCheck = g.inCheck();
      let isOver = false;
      let winner: PieceColor | 'draw' | null = null;
      let reason: GameTermination = null;

      if (g.isCheckmate()) {
        isOver = true;
        winner = g.turn() === 'w' ? 'b' : 'w';
        reason = 'checkmate';
        const isPlayerWin = winner === playerColor;
        sounds.playGameEnd(isPlayerWin);
        recordGameResult(skillLevel, isPlayerWin ? 'win' : 'loss');
      } else if (g.isStalemate()) {
        isOver = true;
        winner = 'draw';
        reason = 'stalemate';
        sounds.playGameEnd(false);
        recordGameResult(skillLevel, 'draw');
      } else if (g.isThreefoldRepetition()) {
        isOver = true;
        winner = 'draw';
        reason = 'threefold_repetition';
        sounds.playGameEnd(false);
        recordGameResult(skillLevel, 'draw');
      } else if (g.isInsufficientMaterial()) {
        isOver = true;
        winner = 'draw';
        reason = 'insufficient_material';
        sounds.playGameEnd(false);
        recordGameResult(skillLevel, 'draw');
      }

      const newStatus = { isOver, winner, reason, inCheck };
      setStatus(newStatus);
      if (isOver) {
        handleGameEndRecord(winner, reason, overrideMoves || moves);
      }
      return newStatus;
    },
    [playerColor, skillLevel, moves, handleGameEndRecord]
  );

  const applyEngineMove = useCallback(
    (bestMove: string, from: string, to: string, promotion?: string) => {
      setGame((prevGame) => {
        if (prevGame.isGameOver()) return prevGame;
        const newGame = new Chess(prevGame.fen());
        const fenBefore = prevGame.fen();

        try {
          const moveResult = newGame.move({
            from,
            to,
            promotion: (promotion as PieceType) || 'q'
          });

          if (moveResult) {
            const fenAfter = newGame.fen();
            setLastMove({ from, to });

            if (moveResult.captured) {
              sounds.playCapture();
            } else {
              sounds.playMove();
            }

            if (newGame.inCheck()) {
              sounds.playCheck();
            }

            const record: MoveRecord = {
              san: moveResult.san,
              from,
              to,
              piece: moveResult.piece as PieceType,
              color: moveResult.color as PieceColor,
              captured: moveResult.captured as PieceType | undefined,
              promotion: moveResult.promotion as PieceType | undefined,
              fenBefore,
              fenAfter
            };

            setMoves((prev) => [...prev, record]);
            setCurrentMoveIndex((prev) => prev + 1);
            checkAndSetGameStatus(newGame);
          }
        } catch (e) {
          console.error('Engine move error:', e);
        }

        return newGame;
      });
    },
    [checkAndSetGameStatus]
  );

  // Engine move callback with realistic human thinking delay
  const handleEngineMove = useCallback(
    (bestMove: string, from: string, to: string, promotion?: string) => {
      const targetDelay = calculateMoveTime({
        currentPly: moves.length,
        targetElo,
        chess: game,
        lastMove
      });

      const elapsed = performance.now() - engineSearchStartTimeRef.current;
      const remainingDelay = Math.max(0, targetDelay - elapsed);

      if (remainingDelay > 15) {
        setIsDelaying(true);
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = window.setTimeout(() => {
          setIsDelaying(false);
          delayTimeoutRef.current = null;
          applyEngineMove(bestMove, from, to, promotion);
        }, remainingDelay);
      } else {
        setIsDelaying(false);
        applyEngineMove(bestMove, from, to, promotion);
      }
    },
    [moves.length, targetElo, game, lastMove, applyEngineMove]
  );

  const {
    isSearching,
    engineStats,
    candidates,
    startSearch,
    stopSearch,
    evaluateFen,
    analyzeFen
  } = useEngineWorker(handleEngineMove);

  // Trigger engine turn when it's engine's turn to move
  useEffect(() => {
    if (status.isOver) return;
    const isEngineTurn = game.turn() !== playerColor;
    if (isEngineTurn && !isSearching && !isDelaying) {
      engineSearchStartTimeRef.current = performance.now();
      startSearch(game.fen(), skillLevel, personality, undefined, undefined, targetElo);
    }
  }, [game, playerColor, skillLevel, targetElo, personality, status.isOver, isSearching, isDelaying, startSearch]);

  // Clean up pending delay timeout on unmount
  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = null;
      }
    };
  }, []);

  // Update evaluation bar on turn change
  useEffect(() => {
    evaluateFen(game.fen()).then((sc) => {
      // Score is relative to side to move; convert to White perspective
      const whiteScore = game.turn() === 'w' ? sc : -sc;
      setEvalScore(whiteScore);
    });
  }, [game, evaluateFen]);

  // Autosave to localStorage
  useEffect(() => {
    try {
      if (moves.length > 0) {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            fen: game.fen(),
            moves,
            playerColor,
            skillLevel,
            personality,
            lastMove
          })
        );
      }
    } catch (e) {}
  }, [game, moves, playerColor, skillLevel, personality, lastMove]);

  // Restore saved game on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.fen) {
          const restoredGame = new Chess(parsed.fen);
          setGame(restoredGame);
          if (parsed.moves) setMoves(parsed.moves);
          if (parsed.playerColor) setPlayerColor(parsed.playerColor);
          if (parsed.skillLevel) setSkillLevel(parsed.skillLevel);
          if (parsed.personality) setPersonality(parsed.personality);
          if (parsed.lastMove) setLastMove(parsed.lastMove);
          setCurrentMoveIndex(parsed.moves ? parsed.moves.length - 1 : -1);
          checkAndSetGameStatus(restoredGame);
        }
      }
    } catch (e) {}
  }, []);

  // Make human move
  const makeMove = useCallback(
    (from: string, to: string, promotion?: PieceType): boolean => {
      if (status.isOver || isSearching || isDelaying) return false;
      if (game.turn() !== playerColor) return false;

      const fenBefore = game.fen();
      const newGame = new Chess(fenBefore);

      try {
        const moveResult = newGame.move({
          from,
          to,
          promotion: promotion || 'q'
        });

        if (!moveResult) return false;

        const fenAfter = newGame.fen();
        setLastMove({ from, to });

        if (moveResult.captured) {
          sounds.playCapture();
        } else {
          sounds.playMove();
        }

        if (newGame.inCheck()) {
          sounds.playCheck();
        }

        const moveRecord: MoveRecord = {
          san: moveResult.san,
          from,
          to,
          piece: moveResult.piece as PieceType,
          color: moveResult.color as PieceColor,
          captured: moveResult.captured as PieceType | undefined,
          promotion: moveResult.promotion as PieceType | undefined,
          fenBefore,
          fenAfter
        };

        setGame(newGame);
        setMoves((prev) => [...prev, moveRecord]);
        setCurrentMoveIndex((prev) => prev + 1);
        checkAndSetGameStatus(newGame);

        // Asynchronously analyze move for blunder detection
        analyzeFen(fenBefore, 3).then((analysis) => {
          evaluateFen(fenAfter).then((afterScore) => {
            const beforeScore = analysis.score;
            // Loss from player's perspective
            const swing = playerColor === 'w' ? beforeScore - (-afterScore) : beforeScore - (-afterScore);
            let blunderTag: MoveRecord['blunderTag'] = undefined;
            if (swing > 250) blunderTag = 'blunder';
            else if (swing > 120) blunderTag = 'mistake';
            else if (swing > 60) blunderTag = 'inaccuracy';
            else if (analysis.bestMove.startsWith(`${from}${to}`)) blunderTag = 'best';

            setMoves((prevMoves) =>
              prevMoves.map((m) =>
                m.fenBefore === fenBefore
                  ? {
                      ...m,
                      evalBefore: beforeScore,
                      evalAfter: afterScore,
                      blunderTag,
                      engineBestMove: analysis.bestMove,
                      enginePv: analysis.pv,
                      centipawnLoss: Math.max(0, swing)
                    }
                  : m
              )
            );
          });
        });

        return true;
      } catch (err) {
        return false;
      }
    },
    [status.isOver, isSearching, isDelaying, game, playerColor, checkAndSetGameStatus, analyzeFen, evaluateFen]
  );

  const resetGame = useCallback(() => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    setIsDelaying(false);
    stopSearch();
    const fresh = new Chess();
    setGame(fresh);
    setMoves([]);
    setCurrentMoveIndex(-1);
    setLastMove(null);
    setLastRatingChange(null);
    setStatus({ isOver: false, winner: null, reason: null, inCheck: false });
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }, [stopSearch]);

  const undoMove = useCallback(() => {
    if (moves.length === 0 || isSearching || isDelaying) return;
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    setIsDelaying(false);
    stopSearch();

    // In a human vs engine match, undo 2 plies (both engine and human move)
    // unless engine hasn't moved yet
    const pliesToUndo = moves.length >= 2 ? 2 : 1;
    const targetMoveIndex = moves.length - pliesToUndo - 1;

    let targetFen = new Chess().fen();
    if (targetMoveIndex >= 0) {
      targetFen = moves[targetMoveIndex].fenAfter;
    }

    const reconstructed = new Chess(targetFen);
    const newMoves = moves.slice(0, targetMoveIndex + 1);

    setGame(reconstructed);
    setMoves(newMoves);
    setCurrentMoveIndex(targetMoveIndex);
    setLastMove(targetMoveIndex >= 0 ? { from: newMoves[targetMoveIndex].from, to: newMoves[targetMoveIndex].to } : null);
    checkAndSetGameStatus(reconstructed, newMoves);
  }, [moves, isSearching, isDelaying, stopSearch, checkAndSetGameStatus]);

  const requestTakeback = useCallback(() => {
    if (status.isOver || isSearching || isDelaying || moves.length === 0) return false;
    undoMove();
    return true;
  }, [status.isOver, isSearching, isDelaying, moves.length, undoMove]);

  const abortGame = useCallback(() => {
    if (status.isOver) return false;
    if (moves.length >= 2) return false;
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    setIsDelaying(false);
    stopSearch();
    setStatus({
      isOver: true,
      winner: null,
      reason: 'aborted',
      inCheck: false
    });
    setLastRatingChange(null);
    return true;
  }, [status.isOver, moves.length, stopSearch]);

  const resign = useCallback(() => {
    if (status.isOver) return;
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    setIsDelaying(false);
    stopSearch();
    const winner = playerColor === 'w' ? 'b' : 'w';
    setStatus({
      isOver: true,
      winner,
      reason: 'resignation',
      inCheck: false
    });
    sounds.playGameEnd(false);
    handleGameEndRecord(winner, 'resignation', moves);
  }, [status.isOver, playerColor, stopSearch, handleGameEndRecord, moves]);

  const offerDraw = useCallback(() => {
    if (status.isOver) return;
    // Engine accepts draw if eval is close to 0 (-50 to +50) or if casual/low level
    if (skillLevel <= 3 || Math.abs(evalScore) < 60) {
      stopSearch();
      setStatus({
        isOver: true,
        winner: 'draw',
        reason: 'draw_agreement',
        inCheck: false
      });
      sounds.playGameEnd(false);
      handleGameEndRecord('draw', 'draw_agreement', moves);
      alert('The engine has ACCEPTED your draw offer!');
    } else {
      alert('The engine has DECLINED your draw offer and plays on!');
    }
  }, [status.isOver, skillLevel, evalScore, stopSearch, handleGameEndRecord, moves]);

  const importFen = useCallback(
    (fen: string): boolean => {
      try {
        const testGame = new Chess(fen);
        stopSearch();
        setGame(testGame);
        setMoves([]);
        setCurrentMoveIndex(-1);
        setLastMove(null);
        checkAndSetGameStatus(testGame);
        return true;
      } catch (e) {
        return false;
      }
    },
    [stopSearch, checkAndSetGameStatus]
  );

  const importPgn = useCallback(
    (pgn: string): boolean => {
      try {
        const testGame = new Chess();
        testGame.loadPgn(pgn);
        stopSearch();
        setGame(testGame);
        // Extract moves from pgn history
        const pgnMoves = testGame.history({ verbose: true });
        const stepGame = new Chess();
        const records: MoveRecord[] = [];
        for (const m of pgnMoves) {
          const fenB = stepGame.fen();
          stepGame.move(m);
          const fenA = stepGame.fen();
          records.push({
            san: m.san,
            from: m.from,
            to: m.to,
            piece: m.piece as PieceType,
            color: m.color as PieceColor,
            captured: m.captured as PieceType | undefined,
            promotion: m.promotion as PieceType | undefined,
            fenBefore: fenB,
            fenAfter: fenA
          });
        }
        setMoves(records);
        setCurrentMoveIndex(records.length - 1);
        setLastMove(records.length > 0 ? { from: records[records.length - 1].from, to: records[records.length - 1].to } : null);
        checkAndSetGameStatus(testGame);
        return true;
      } catch (e) {
        return false;
      }
    },
    [stopSearch, checkAndSetGameStatus]
  );

  const goToMove = useCallback(
    (index: number) => {
      if (index < -1 || index >= moves.length || isSearching) return;
      setCurrentMoveIndex(index);
      const targetFen = index === -1 ? new Chess().fen() : moves[index].fenAfter;
      const reconstructed = new Chess(targetFen);
      setGame(reconstructed);
      setLastMove(index >= 0 ? { from: moves[index].from, to: moves[index].to } : null);
      checkAndSetGameStatus(reconstructed);
    },
    [moves, isSearching, checkAndSetGameStatus]
  );

  return {
    game,
    playerColor,
    setPlayerColor,
    skillLevel,
    setSkillLevel,
    targetElo,
    setTargetElo,
    personality,
    setPersonality,
    moves,
    currentMoveIndex,
    setCurrentMoveIndex,
    lastMove,
    evalScore,
    status,
    isSearching: isSearching || isDelaying,
    engineStats,
    candidates,
    makeMove,
    resetGame,
    undoMove,
    goToMove,
    resign,
    offerDraw,
    abortGame,
    requestTakeback,
    lastRatingChange,
    importFen,
    importPgn
  };
}

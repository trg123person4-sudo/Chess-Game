import { useState, useEffect, useRef, useCallback } from 'react';
import { PieceColor } from '../types/chess';
import { sounds } from '../audio/soundEffects';

export interface ClockControl {
  name: string;
  initialMinutes: number;
  incrementSeconds: number;
  delaySeconds?: number;
}

export const CLOCK_PRESETS: ClockControl[] = [
  { name: 'No Clock', initialMinutes: 0, incrementSeconds: 0 },
  { name: 'Bullet (1+0)', initialMinutes: 1, incrementSeconds: 0 },
  { name: 'Bullet (2+1)', initialMinutes: 2, incrementSeconds: 1 },
  { name: 'Blitz (3+2)', initialMinutes: 3, incrementSeconds: 2 },
  { name: 'Blitz (5+0)', initialMinutes: 5, incrementSeconds: 0 },
  { name: 'Rapid (10+0)', initialMinutes: 10, incrementSeconds: 0 },
  { name: 'Rapid (15+10)', initialMinutes: 15, incrementSeconds: 10 },
  { name: 'Classical (30+0)', initialMinutes: 30, incrementSeconds: 0 }
];

export function useChessClock(
  turn: PieceColor,
  isGameOver: boolean,
  onTimeout?: (loser: PieceColor) => void
) {
  const [activeControl, setActiveControl] = useState<ClockControl>(CLOCK_PRESETS[0]);
  const [whiteSeconds, setWhiteSeconds] = useState<number>(0);
  const [blackSeconds, setBlackSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [delayRemaining, setDelayRemaining] = useState<number>(0);

  const playedLowTimeRef = useRef<{ w: boolean; b: boolean }>({ w: false, b: false });

  const resetClock = useCallback((control: ClockControl) => {
    setActiveControl(control);
    const secs = control.initialMinutes * 60;
    setWhiteSeconds(secs);
    setBlackSeconds(secs);
    setDelayRemaining(control.delaySeconds || 0);
    setIsRunning(control.initialMinutes > 0);
    playedLowTimeRef.current = { w: false, b: false };
  }, []);

  const onMoveCompleted = useCallback(
    (movedColor: PieceColor) => {
      if (activeControl.initialMinutes <= 0 || isGameOver) return;
      if (movedColor === 'w') {
        setWhiteSeconds((prev) => prev + activeControl.incrementSeconds);
      } else {
        setBlackSeconds((prev) => prev + activeControl.incrementSeconds);
      }
      setDelayRemaining(activeControl.delaySeconds || 0);
    },
    [activeControl, isGameOver]
  );

  useEffect(() => {
    if (!isRunning || isGameOver || activeControl.initialMinutes <= 0) return;

    const interval = setInterval(() => {
      // If delay is active, count down delay first
      if (delayRemaining > 0) {
        setDelayRemaining((prev) => Math.max(0, prev - 1));
        return;
      }

      if (turn === 'w') {
        setWhiteSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsRunning(false);
            if (onTimeout) onTimeout('w');
            return 0;
          }
          if (prev <= 10 && !playedLowTimeRef.current.w) {
            sounds.playLowTimeWarning();
            playedLowTimeRef.current.w = true;
          }
          return prev - 1;
        });
      } else {
        setBlackSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsRunning(false);
            if (onTimeout) onTimeout('b');
            return 0;
          }
          if (prev <= 10 && !playedLowTimeRef.current.b) {
            sounds.playLowTimeWarning();
            playedLowTimeRef.current.b = true;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isGameOver, turn, activeControl, delayRemaining, onTimeout]);

  const isWhiteLowTime = activeControl.initialMinutes > 0 && whiteSeconds <= 15 && whiteSeconds > 0;
  const isBlackLowTime = activeControl.initialMinutes > 0 && blackSeconds <= 15 && blackSeconds > 0;

  return {
    activeControl,
    whiteSeconds,
    blackSeconds,
    isRunning,
    isWhiteLowTime,
    isBlackLowTime,
    resetClock,
    onMoveCompleted,
    setIsRunning
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

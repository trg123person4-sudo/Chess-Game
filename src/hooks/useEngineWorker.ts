import { useEffect, useRef, useState, useCallback } from 'react';
import { EngineInboundMessage, EngineOutboundMessage, CandidateMove } from '../types/engine';

export interface EngineStats {
  depth: number;
  score: number; // centipawns (from engine's perspective or white's perspective)
  nodes: number;
  timeMs: number;
  nps: number;
  pv: string[];
}

export interface UseEngineWorkerReturn {
  isSearching: boolean;
  engineStats: EngineStats;
  candidates: CandidateMove[];
  startSearch: (
    fen: string,
    level: number,
    personality?: 'balanced' | 'aggressive' | 'positional',
    timeBudgetMs?: number,
    maxDepth?: number,
    targetElo?: number
  ) => void;
  stopSearch: () => void;
  evaluateFen: (fen: string) => Promise<number>;
  analyzeFen: (fen: string, depth?: number) => Promise<{ score: number; bestMove: string; pv: string[] }>;
}

export function useEngineWorker(
  onEngineMove?: (bestMove: string, from: string, to: string, promotion?: string) => void
): UseEngineWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [engineStats, setEngineStats] = useState<EngineStats>({
    depth: 0,
    score: 0,
    nodes: 0,
    timeMs: 0,
    nps: 0,
    pv: []
  });
  const [candidates, setCandidates] = useState<CandidateMove[]>([]);

  // Pending promises for evaluate / analyze
  const evalResolverRef = useRef<((score: number) => void) | null>(null);
  const analyzeResolverRef = useRef<((result: { score: number; bestMove: string; pv: string[] }) => void) | null>(null);

  useEffect(() => {
    // Vite Web Worker initialization
    const worker = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<EngineOutboundMessage>) => {
      const data = e.data;
      switch (data.type) {
        case 'SEARCH_PROGRESS': {
          setEngineStats({
            depth: data.depth,
            score: data.score,
            nodes: data.nodes,
            timeMs: data.timeMs,
            nps: data.nps,
            pv: data.pv
          });
          break;
        }
        case 'SEARCH_COMPLETE': {
          setIsSearching(false);
          setEngineStats({
            depth: data.depth,
            score: data.score,
            nodes: data.nodes,
            timeMs: data.timeMs,
            nps: data.timeMs > 0 ? Math.round((data.nodes / data.timeMs) * 1000) : 0,
            pv: data.pv
          });
          if (data.candidates) {
            setCandidates(data.candidates);
          }
          if (onEngineMove) {
            onEngineMove(data.bestMove, data.from, data.to, data.promotion);
          }
          break;
        }
        case 'EVALUATE_COMPLETE': {
          if (evalResolverRef.current) {
            evalResolverRef.current(data.score);
            evalResolverRef.current = null;
          }
          break;
        }
        case 'ANALYSIS_COMPLETE': {
          if (analyzeResolverRef.current) {
            analyzeResolverRef.current({
              score: data.score,
              bestMove: data.bestMove,
              pv: data.pv
            });
            analyzeResolverRef.current = null;
          }
          break;
        }
      }
    };

    return () => {
      worker.terminate();
    };
  }, [onEngineMove]);

  const startSearch = useCallback(
    (
      fen: string,
      level: number,
      personality?: 'balanced' | 'aggressive' | 'positional',
      timeBudgetMs?: number,
      maxDepth?: number,
      targetElo?: number
    ) => {
      if (!workerRef.current) return;
      setIsSearching(true);
      const msg: EngineInboundMessage = {
        type: 'SEARCH',
        fen,
        level,
        personality,
        timeBudgetMs,
        maxDepth,
        targetElo
      };
      workerRef.current.postMessage(msg);
    },
    []
  );

  const stopSearch = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'STOP' });
    setIsSearching(false);
  }, []);

  const evaluateFen = useCallback((fen: string): Promise<number> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve(0);
        return;
      }
      evalResolverRef.current = resolve;
      workerRef.current.postMessage({ type: 'EVALUATE', fen });
    });
  }, []);

  const analyzeFen = useCallback(
    (fen: string, depth = 5): Promise<{ score: number; bestMove: string; pv: string[] }> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve({ score: 0, bestMove: '', pv: [] });
          return;
        }
        analyzeResolverRef.current = resolve;
        workerRef.current.postMessage({ type: 'ANALYZE', fen, depth });
      });
    },
    []
  );

  return {
    isSearching,
    engineStats,
    candidates,
    startSearch,
    stopSearch,
    evaluateFen,
    analyzeFen
  };
}

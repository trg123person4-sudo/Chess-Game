export interface SkillLevelConfig {
  id: number;
  name: string;
  eloEstimate: number;
  uciElo: number;            // Stockfish official UCI_Elo bound [1320 - 3190]
  uciLimitStrength: boolean;
  maxDepth: number;
  timeBudgetMs: number;
  temperature: number;       // For Boltzmann/softmax candidate selection (0 = greedy best move)
  blunderWindowCp: number;   // Candidate selection threshold in centipawns
  blunderProbability: number;// Probability of taking a suboptimal blunder move
  maxBookPlies: number;      // Maximum half-moves to stay in opening book
  positionalWeight: number;  // 0.0 (pure material) to 1.0 (full positional evaluation)
  description: string;
}

export type EngineInboundMessage =
  | {
      type: 'SEARCH';
      fen: string;
      level: number;
      targetElo?: number;
      timeBudgetMs?: number;
      maxDepth?: number;
      personality?: 'balanced' | 'aggressive' | 'positional';
    }
  | {
      type: 'STOP';
    }
  | {
      type: 'ANALYZE';
      fen: string;
      depth: number;
    }
  | {
      type: 'EVALUATE';
      fen: string;
    };

export interface CandidateMove {
  move: string;
  from: string;
  to: string;
  score: number;
}

export type EngineOutboundMessage =
  | {
      type: 'SEARCH_PROGRESS';
      depth: number;
      score: number;
      nodes: number;
      timeMs: number;
      pv: string[];
      nps: number;
    }
  | {
      type: 'SEARCH_COMPLETE';
      bestMove: string;
      from: string;
      to: string;
      promotion?: string;
      score: number;
      depth: number;
      nodes: number;
      timeMs: number;
      pv: string[];
      candidates?: CandidateMove[];
    }
  | {
      type: 'ANALYSIS_COMPLETE';
      fen: string;
      score: number;
      bestMove: string;
      pv: string[];
      depth: number;
    }
  | {
      type: 'EVALUATE_COMPLETE';
      fen: string;
      score: number;
    };

import { Chess, Move } from 'chess.js';
import { evaluatePosition } from './evaluation';
import { computeZobristHash } from './zobrist';
import { globalTT, TTFlag } from './transposition';
import { MoveOrderer } from './moveOrdering';
import { CandidateMove, SkillLevelConfig } from '../types/engine';
import { getSkillLevel, getSkillConfigForElo } from './skillLevels';

export interface SearchOptions {
  level?: number;
  targetElo?: number;
  timeBudgetMs?: number;
  maxDepth?: number;
  personality?: 'balanced' | 'aggressive' | 'positional';
  onProgress?: (depth: number, score: number, nodes: number, timeMs: number, pv: string[]) => void;
}

export interface SearchResult {
  bestMove: string; // UCI format e.g. "e2e4"
  from: string;
  to: string;
  promotion?: string;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: string[];
  candidates: CandidateMove[];
}

export class ChessSearcher {
  private orderer = new MoveOrderer();
  private nodes = 0;
  private startTime = 0;
  private deadline = 0;
  private stopRequested = false;
  private isTimeUp = false;

  stop(): void {
    this.stopRequested = true;
  }

  search(chess: Chess, options: SearchOptions = {}): SearchResult {
    this.nodes = 0;
    this.stopRequested = false;
    this.isTimeUp = false;
    this.orderer.clear();
    this.startTime = performance.now();

    const skill = options.targetElo
      ? getSkillConfigForElo(options.targetElo)
      : getSkillLevel(options.level || 5);
    const timeBudget = options.timeBudgetMs ?? skill.timeBudgetMs;
    const maxDepth = options.maxDepth ?? skill.maxDepth;
    this.deadline = this.startTime + timeBudget;

    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) {
      return {
        bestMove: '',
        from: '',
        to: '',
        score: chess.inCheck() ? -30000 : 0,
        depth: 0,
        nodes: 0,
        timeMs: 0,
        pv: [],
        candidates: []
      };
    }

    if (legalMoves.length === 1) {
      const single = legalMoves[0];
      return {
        bestMove: `${single.from}${single.to}${single.promotion || ''}`,
        from: single.from,
        to: single.to,
        promotion: single.promotion,
        score: 0,
        depth: 1,
        nodes: 1,
        timeMs: 1,
        pv: [single.san],
        candidates: [{ move: single.san, from: single.from, to: single.to, score: 0 }]
      };
    }

    let overallBestMove = legalMoves[0];
    let overallBestScore = -Infinity;
    let completedDepth = 1;
    let pvMoves: string[] = [];
    let rootCandidates: CandidateMove[] = [];

    // Iterative Deepening
    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (this.isTimeUp || this.stopRequested || performance.now() >= this.deadline) {
        this.isTimeUp = true;
        break;
      }

      let alpha = -Infinity;
      const beta = Infinity;
      let iterationBestMove: Move | null = null;
      let iterationBestScore = -Infinity;
      const iterationCandidates: CandidateMove[] = [];

      // Probe TT for root move ordering
      const rootHash = computeZobristHash(chess);
      const rootEntry = globalTT.get(rootHash);
      const rootTtMove = rootEntry ? rootEntry.bestMove : null;

      const orderedMoves = this.orderer.orderMoves(legalMoves, rootTtMove, 0);

      for (const move of orderedMoves) {
        if (this.isTimeUp || this.stopRequested || performance.now() >= this.deadline) {
          this.isTimeUp = true;
          break;
        }

        chess.move(move);
        const score = -this.alphaBeta(
          chess,
          currentDepth - 1,
          -beta,
          -alpha,
          1,
          options.personality,
          skill.positionalWeight
        );
        chess.undo();

        if (this.isTimeUp || this.stopRequested) {
          break;
        }

        iterationCandidates.push({
          move: move.san,
          from: move.from,
          to: move.to,
          score
        });

        if (score > iterationBestScore) {
          iterationBestScore = score;
          iterationBestMove = move;
        }

        // If forced checkmate found at root, stop evaluating inferior alternative moves
        if (score > 20000) {
          break;
        }

        if (score > alpha) {
          alpha = score;
        }
      }

      // If search was interrupted mid-depth by timer, do NOT use this incomplete iteration
      if (this.isTimeUp || this.stopRequested) {
        break;
      }

      if (iterationBestMove) {
        overallBestMove = iterationBestMove;
        overallBestScore = iterationBestScore;
        completedDepth = currentDepth;
        rootCandidates = iterationCandidates;

        const bestUci = `${iterationBestMove.from}${iterationBestMove.to}${iterationBestMove.promotion || ''}`;
        globalTT.set(rootHash, {
          hash: rootHash,
          depth: currentDepth,
          score: iterationBestScore,
          flag: 'EXACT',
          bestMove: bestUci
        });

        pvMoves = [iterationBestMove.san];
        if (options.onProgress) {
          options.onProgress(
            currentDepth,
            iterationBestScore,
            this.nodes,
            performance.now() - this.startTime,
            pvMoves
          );
        }
      }

      // Early break if checkmate detected
      if (iterationBestScore > 20000 || iterationBestScore < -20000) {
        break;
      }
    }

    // Move Selection with Skill-Level Noise / Candidate Pool
    const chosenMove = this.selectMoveBySkill(
      legalMoves,
      rootCandidates.length > 0 ? rootCandidates : [{ move: overallBestMove.san, from: overallBestMove.from, to: overallBestMove.to, score: overallBestScore }],
      overallBestMove,
      skill,
      overallBestScore
    );

    const timeSpent = Math.max(1, Math.round(performance.now() - this.startTime));
    const uci = `${chosenMove.from}${chosenMove.to}${chosenMove.promotion || ''}`;

    return {
      bestMove: uci,
      from: chosenMove.from,
      to: chosenMove.to,
      promotion: chosenMove.promotion,
      score: overallBestScore,
      depth: completedDepth,
      nodes: this.nodes,
      timeMs: timeSpent,
      pv: pvMoves,
      candidates: rootCandidates
    };
  }

  private alphaBeta(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    personality?: 'balanced' | 'aggressive' | 'positional',
    positionalWeight = 1.0
  ): number {
    this.nodes++;

    // Time budget check every 64 nodes
    if ((this.nodes & 63) === 0) {
      if (performance.now() >= this.deadline) {
        this.isTimeUp = true;
      }
    }

    if (this.isTimeUp || this.stopRequested) {
      return 0;
    }

    // Transposition table probe
    const hash = computeZobristHash(chess);
    const ttEntry = globalTT.get(hash);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 'EXACT') return ttEntry.score;
      if (ttEntry.flag === 'LOWERBOUND' && ttEntry.score >= beta) return ttEntry.score;
      if (ttEntry.flag === 'UPPERBOUND' && ttEntry.score <= alpha) return ttEntry.score;
    }

    const inCheck = chess.inCheck();
    const searchDepth = inCheck ? depth + 1 : depth;

    if (searchDepth <= 0) {
      return this.quiescence(chess, alpha, beta, ply, personality, positionalWeight);
    }

    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) {
      if (inCheck) {
        return -30000 + ply; // Closer mate is preferred
      }
      return 0; // Stalemate
    }

    if (chess.isDraw() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      return 0;
    }

    const ttBestMove = ttEntry ? ttEntry.bestMove : null;
    const orderedMoves = this.orderer.orderMoves(legalMoves, ttBestMove, ply);

    let bestScore = -Infinity;
    let bestMove: Move | null = null;
    let flag: TTFlag = 'UPPERBOUND';

    for (const move of orderedMoves) {
      chess.move(move);
      const score = -this.alphaBeta(
        chess,
        searchDepth - 1,
        -beta,
        -alpha,
        ply + 1,
        personality,
        positionalWeight
      );
      chess.undo();

      if (this.isTimeUp || this.stopRequested) {
        return 0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }

      if (score > alpha) {
        alpha = score;
        flag = 'EXACT';
      }

      if (alpha >= beta) {
        flag = 'LOWERBOUND';
        const moveUci = `${move.from}${move.to}${move.promotion || ''}`;
        if (!move.captured) {
          this.orderer.storeKiller(ply, moveUci);
          this.orderer.incrementHistory(move.from, move.to, depth);
        }
        break;
      }
    }

    if (!this.isTimeUp && !this.stopRequested && bestMove) {
      const bestUci = `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
      globalTT.set(hash, {
        hash,
        depth,
        score: bestScore,
        flag,
        bestMove: bestUci
      });
    }

    return bestScore;
  }

  // Quiescence search with delta pruning and depth capping
  private quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    ply: number,
    personality?: 'balanced' | 'aggressive' | 'positional',
    positionalWeight = 1.0
  ): number {
    this.nodes++;

    if ((this.nodes & 63) === 0) {
      if (performance.now() >= this.deadline) {
        this.isTimeUp = true;
      }
    }

    if (this.isTimeUp || this.stopRequested) {
      return 0;
    }

    // Stand-pat evaluation
    const standPat = evaluatePosition(chess, { positionalWeight, personality });
    if (standPat >= beta) {
      return beta;
    }
    if (standPat > alpha) {
      alpha = standPat;
    }

    // Limit quiescence depth to 6 plies to prevent search explosion
    if (ply > 8) {
      return standPat;
    }

    // Delta pruning: if even capturing a Queen cannot raise alpha, skip
    const BIG_DELTA = 975;
    if (standPat < alpha - BIG_DELTA) {
      return alpha;
    }

    // Only search captures and promotions in quiescence
    const legalMoves = chess.moves({ verbose: true });
    const captureMoves = legalMoves.filter((m) => m.captured || m.promotion);

    const orderedCaptures = this.orderer.orderMoves(captureMoves, null, ply);

    for (const move of orderedCaptures) {
      chess.move(move);
      const score = -this.quiescence(chess, -beta, -alpha, ply + 1, personality, positionalWeight);
      chess.undo();

      if (this.isTimeUp || this.stopRequested) {
        return 0;
      }

      if (score >= beta) {
        return beta;
      }
      if (score > alpha) {
        alpha = score;
      }
    }

    return alpha;
  }

  // Softmax / Boltzmann move selection with blunder injection for calibrated skill levels
  private selectMoveBySkill(
    legalMoves: Move[],
    candidates: CandidateMove[],
    bestMove: Move,
    skill: SkillLevelConfig,
    bestScore: number = 0
  ): Move {
    if (skill.temperature <= 0 || candidates.length <= 1 || bestScore > 20000) {
      return bestMove;
    }

    // 1. Blunder Injection: Low-Elo players occasionally make deliberate tactical mistakes
    if (skill.blunderProbability > 0 && Math.random() < skill.blunderProbability && candidates.length > 1) {
      const suboptimalCandidates = candidates.slice(1);
      const randomBlunder = suboptimalCandidates[Math.floor(Math.random() * suboptimalCandidates.length)];
      const matchedBlunder = legalMoves.find((m) => m.san === randomBlunder.move);
      if (matchedBlunder) {
        return matchedBlunder;
      }
    }

    // 2. Boltzmann Softmax Selection
    const maxScore = Math.max(...candidates.map((c) => c.score));
    const filteredCandidates = skill.blunderWindowCp > 0
      ? candidates.filter((c) => maxScore - c.score <= skill.blunderWindowCp)
      : candidates;

    const pool = filteredCandidates.length > 0 ? filteredCandidates : candidates;

    const tempScale = Math.max(1, skill.temperature * 100);
    const expScores = pool.map((c) => Math.exp((c.score - maxScore) / tempScale));
    const sumExp = expScores.reduce((sum, val) => sum + val, 0);

    let rand = Math.random() * sumExp;
    let chosenCandidate = pool[0];

    for (let i = 0; i < pool.length; i++) {
      rand -= expScores[i];
      if (rand <= 0) {
        chosenCandidate = pool[i];
        break;
      }
    }

    const matchedMove = legalMoves.find((m) => m.san === chosenCandidate.move);
    return matchedMove || bestMove;
  }
}

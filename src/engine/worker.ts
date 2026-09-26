import { Chess } from 'chess.js';
import { ChessSearcher } from './search';
import { evaluatePosition } from './evaluation';
import { EngineInboundMessage, EngineOutboundMessage } from '../types/engine';
import { getSkillLevel } from './skillLevels';

const searcher = new ChessSearcher();

self.onmessage = (event: MessageEvent<EngineInboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'SEARCH': {
      try {
        const chess = new Chess(msg.fen);
        const skill = getSkillLevel(msg.level);

        const result = searcher.search(chess, {
          level: msg.level,
          targetElo: msg.targetElo,
          timeBudgetMs: msg.timeBudgetMs,
          maxDepth: msg.maxDepth,
          personality: msg.personality,
          onProgress: (depth, score, nodes, timeMs, pv) => {
            const nps = timeMs > 0 ? Math.round((nodes / timeMs) * 1000) : 0;
            const progressMsg: EngineOutboundMessage = {
              type: 'SEARCH_PROGRESS',
              depth,
              score,
              nodes,
              timeMs,
              pv,
              nps
            };
            self.postMessage(progressMsg);
          }
        });

        const completeMsg: EngineOutboundMessage = {
          type: 'SEARCH_COMPLETE',
          bestMove: result.bestMove,
          from: result.from,
          to: result.to,
          promotion: result.promotion,
          score: result.score,
          depth: result.depth,
          nodes: result.nodes,
          timeMs: result.timeMs,
          pv: result.pv,
          candidates: result.candidates
        };
        self.postMessage(completeMsg);
      } catch (err: unknown) {
        console.error('Error during engine search in worker:', err);
      }
      break;
    }

    case 'STOP': {
      searcher.stop();
      break;
    }

    case 'EVALUATE': {
      try {
        const chess = new Chess(msg.fen);
        const score = evaluatePosition(chess);
        const reply: EngineOutboundMessage = {
          type: 'EVALUATE_COMPLETE',
          fen: msg.fen,
          score
        };
        self.postMessage(reply);
      } catch (err: unknown) {
        console.error('Error during evaluate in worker:', err);
      }
      break;
    }

    case 'ANALYZE': {
      try {
        const chess = new Chess(msg.fen);
        const result = searcher.search(chess, {
          maxDepth: msg.depth || 5,
          timeBudgetMs: 1500,
          level: 10 // Analyze at GM level accuracy
        });
        const reply: EngineOutboundMessage = {
          type: 'ANALYSIS_COMPLETE',
          fen: msg.fen,
          score: result.score,
          bestMove: result.bestMove,
          pv: result.pv,
          depth: result.depth
        };
        self.postMessage(reply);
      } catch (err: unknown) {
        console.error('Error during analysis in worker:', err);
      }
      break;
    }
  }
};

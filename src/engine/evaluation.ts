import { Chess } from 'chess.js';
import {
  PIECE_VALUES,
  PAWN_PST,
  KNIGHT_PST,
  BISHOP_PST,
  ROOK_PST,
  QUEEN_PST,
  KING_MIDDLEGAME_PST,
  KING_ENDGAME_PST
} from './constants';
import { PieceColor, PieceType } from '../types/chess';

export interface EvalOptions {
  positionalWeight?: number; // 0.0 to 1.0 (scales positional terms vs material)
  personality?: 'balanced' | 'aggressive' | 'positional';
}

export function evaluatePosition(chess: Chess, options: EvalOptions = {}): number {
  if (chess.isCheckmate()) {
    // If side to move is checkmated, that's immediate -30000
    return -30000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    return 0;
  }

  const positionalWeight = options.positionalWeight !== undefined ? options.positionalWeight : 1.0;
  const personality = options.personality || 'balanced';

  const board = chess.board();
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whitePst = 0;
  let blackPst = 0;

  // Track pawns for structure analysis
  const whitePawnFiles = new Array(8).fill(0);
  const blackPawnFiles = new Array(8).fill(0);
  const whitePawns: { r: number; c: number }[] = [];
  const blackPawns: { r: number; c: number }[] = [];

  let whiteKingPos = { r: 7, c: 4 };
  let blackKingPos = { r: 0, c: 4 };

  // Calculate game phase for tapered evaluation
  // Total non-pawn material value: 4*N(320) + 4*B(330) + 4*R(500) + 2*Q(900) = 1280 + 1320 + 2000 + 1800 = 6400
  let totalNonPawnMaterial = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type as PieceType] || 0;
      const sqIndexWhite = r * 8 + c;
      const sqIndexBlack = (7 - r) * 8 + c;

      if (piece.type !== 'p' && piece.type !== 'k') {
        totalNonPawnMaterial += val;
      }

      if (piece.color === 'w') {
        whiteMaterial += val;
        if (piece.type === 'p') {
          whitePst += PAWN_PST[sqIndexWhite];
          whitePawnFiles[c]++;
          whitePawns.push({ r, c });
        } else if (piece.type === 'n') {
          whitePst += KNIGHT_PST[sqIndexWhite];
        } else if (piece.type === 'b') {
          whitePst += BISHOP_PST[sqIndexWhite];
        } else if (piece.type === 'r') {
          whitePst += ROOK_PST[sqIndexWhite];
        } else if (piece.type === 'q') {
          whitePst += QUEEN_PST[sqIndexWhite];
        } else if (piece.type === 'k') {
          whiteKingPos = { r, c };
        }
      } else {
        blackMaterial += val;
        if (piece.type === 'p') {
          blackPst += PAWN_PST[sqIndexBlack];
          blackPawnFiles[c]++;
          blackPawns.push({ r, c });
        } else if (piece.type === 'n') {
          blackPst += KNIGHT_PST[sqIndexBlack];
        } else if (piece.type === 'b') {
          blackPst += BISHOP_PST[sqIndexBlack];
        } else if (piece.type === 'r') {
          blackPst += ROOK_PST[sqIndexBlack];
        } else if (piece.type === 'q') {
          blackPst += QUEEN_PST[sqIndexBlack];
        } else if (piece.type === 'k') {
          blackKingPos = { r, c };
        }
      }
    }
  }

  // Phase: 1.0 = full middlegame, 0.0 = endgame
  const phase = Math.min(1.0, Math.max(0.0, totalNonPawnMaterial / 6400));

  // Interpolated king PST
  const whiteKingSq = whiteKingPos.r * 8 + whiteKingPos.c;
  const blackKingSq = (7 - blackKingPos.r) * 8 + blackKingPos.c;

  const whiteKingScore = phase * KING_MIDDLEGAME_PST[whiteKingSq] + (1 - phase) * KING_ENDGAME_PST[whiteKingSq];
  const blackKingScore = phase * KING_MIDDLEGAME_PST[blackKingSq] + (1 - phase) * KING_ENDGAME_PST[blackKingSq];

  whitePst += whiteKingScore;
  blackPst += blackKingScore;

  // Pawn Structure
  let whitePawnScore = 0;
  let blackPawnScore = 0;

  // Doubled pawns (-20cp) and isolated pawns (-15cp)
  for (let c = 0; c < 8; c++) {
    if (whitePawnFiles[c] > 1) whitePawnScore -= (whitePawnFiles[c] - 1) * 20;
    if (blackPawnFiles[c] > 1) blackPawnScore -= (blackPawnFiles[c] - 1) * 20;

    const whiteHasLeft = c > 0 && whitePawnFiles[c - 1] > 0;
    const whiteHasRight = c < 7 && whitePawnFiles[c + 1] > 0;
    if (whitePawnFiles[c] > 0 && !whiteHasLeft && !whiteHasRight) {
      whitePawnScore -= 15;
    }

    const blackHasLeft = c > 0 && blackPawnFiles[c - 1] > 0;
    const blackHasRight = c < 7 && blackPawnFiles[c + 1] > 0;
    if (blackPawnFiles[c] > 0 && !blackHasLeft && !blackHasRight) {
      blackPawnScore -= 15;
    }
  }

  // Passed Pawns bonus (higher closer to 8th rank)
  for (const p of whitePawns) {
    let passed = true;
    for (const bp of blackPawns) {
      if (Math.abs(bp.c - p.c) <= 1 && bp.r < p.r) {
        passed = false;
        break;
      }
    }
    if (passed) {
      const rankAdvancement = 7 - p.r;
      whitePawnScore += 15 + rankAdvancement * 10;
    }
  }

  for (const p of blackPawns) {
    let passed = true;
    for (const wp of whitePawns) {
      if (Math.abs(wp.c - p.c) <= 1 && wp.r > p.r) {
        passed = false;
        break;
      }
    }
    if (passed) {
      const rankAdvancement = p.r;
      blackPawnScore += 15 + rankAdvancement * 10;
    }
  }

  // King Safety in middlegame
  let whiteKingSafety = 0;
  let blackKingSafety = 0;

  if (phase > 0.3) {
    // Pawn shield for White king
    const wkc = whiteKingPos.c;
    for (let c = Math.max(0, wkc - 1); c <= Math.min(7, wkc + 1); c++) {
      if (whitePawnFiles[c] === 0) {
        whiteKingSafety -= 25; // Open file near king
      }
    }

    // Pawn shield for Black king
    const bkc = blackKingPos.c;
    for (let c = Math.max(0, bkc - 1); c <= Math.min(7, bkc + 1); c++) {
      if (blackPawnFiles[c] === 0) {
        blackKingSafety -= 25; // Open file near king
      }
    }
  }

  // Mobility
  // Rapid proxy: number of legal moves for side to move
  const sideToMove = chess.turn();
  const mobilityMovesCount = chess.moves().length;
  const mobilityScore = mobilityMovesCount * 2;

  // Personality multipliers
  let personalityPawnMult = 1.0;
  let personalityAttackMult = 1.0;

  if (personality === 'aggressive') {
    personalityAttackMult = 1.8;
  } else if (personality === 'positional') {
    personalityPawnMult = 1.6;
  }

  const materialDiff = whiteMaterial - blackMaterial;
  const positionalDiff =
    (whitePst - blackPst) +
    (whitePawnScore - blackPawnScore) * personalityPawnMult +
    (whiteKingSafety - blackKingSafety) * personalityAttackMult +
    (sideToMove === 'w' ? mobilityScore : -mobilityScore);

  const totalScore = materialDiff + positionalDiff * positionalWeight;

  // Return relative score: positive if side to move is winning
  return sideToMove === 'w' ? Math.round(totalScore) : Math.round(-totalScore);
}

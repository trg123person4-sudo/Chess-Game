import { Position, Move } from './types';
import { squareToCoords, squareToAlgebraic, FILES, RANKS } from './constants';
import { generateLegalMoves } from './moveGen';
import { applyMove } from './makeMove';
import { isCheck, isCheckmate } from './gameStatus';

export function moveToSAN(pos: Position, move: Move): string {
  if (move.isCastling) {
    const isKingside = move.to > move.from;
    const sanBase = isKingside ? 'O-O' : 'O-O-O';
    const nextPos = applyMove(pos, move);
    if (isCheckmate(nextPos)) return `${sanBase}#`;
    if (isCheck(nextPos)) return `${sanBase}+`;
    return sanBase;
  }

  const { file: fromFile, rank: fromRank } = squareToCoords(move.from);
  const destSq = squareToAlgebraic(move.to);
  const isCapture = !!move.captured || move.isEnPassant;

  let san = '';

  if (move.piece === 'p') {
    if (isCapture) {
      san = `${FILES[fromFile]}x${destSq}`;
    } else {
      san = destSq;
    }

    if (move.promotion) {
      san += `=${move.promotion.toUpperCase()}`;
    }
  } else {
    const pieceChar = move.piece.toUpperCase();

    // Check if disambiguation is needed among all legal moves
    const legalMoves = generateLegalMoves(pos);
    const ambiguousMoves = legalMoves.filter(
      (m) =>
        m.piece === move.piece &&
        m.to === move.to &&
        m.from !== move.from &&
        m.color === move.color
    );

    let disambiguation = '';
    if (ambiguousMoves.length > 0) {
      const sameFile = ambiguousMoves.some((m) => squareToCoords(m.from).file === fromFile);
      const sameRank = ambiguousMoves.some((m) => squareToCoords(m.from).rank === fromRank);

      if (!sameFile) {
        disambiguation = FILES[fromFile];
      } else if (!sameRank) {
        disambiguation = RANKS[fromRank];
      } else {
        disambiguation = `${FILES[fromFile]}${RANKS[fromRank]}`;
      }
    }

    san = `${pieceChar}${disambiguation}${isCapture ? 'x' : ''}${destSq}`;
  }

  // Check / Checkmate suffix
  const nextPos = applyMove(pos, move);
  if (isCheckmate(nextPos)) {
    san += '#';
  } else if (isCheck(nextPos)) {
    san += '+';
  }

  return san;
}

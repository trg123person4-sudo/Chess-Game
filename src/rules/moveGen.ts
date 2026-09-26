import { Position, Move, Color, PieceType } from './types';
import { squareToCoords, coordsToSquare, SQ } from './constants';
import { isSquareAttacked } from './attacks';
import { applyMove } from './makeMove';

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

const ORTHOGONAL_DIRS = [
  [0, 1], [0, -1], [1, 0], [-1, 0]
];

const DIAGONAL_DIRS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

const PROMOTION_PIECES: PieceType[] = ['q', 'r', 'b', 'n'];

export function generatePseudoLegalMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const turn = pos.turn;
  const oppColor: Color = turn === 'w' ? 'b' : 'w';

  for (let sq = 0; sq < 64; sq++) {
    const piece = pos.board[sq];
    if (!piece || piece.color !== turn) continue;

    const { file, rank } = squareToCoords(sq);

    switch (piece.type) {
      case 'p': {
        const forward = turn === 'w' ? 1 : -1;
        const startRank = turn === 'w' ? 1 : 6;
        const promoRank = turn === 'w' ? 7 : 0;

        // 1. Single forward step
        const nextRank = rank + forward;
        const singleSq = coordsToSquare(file, nextRank);
        if (nextRank >= 0 && nextRank < 8 && !pos.board[singleSq]) {
          if (nextRank === promoRank) {
            for (const promo of PROMOTION_PIECES) {
              moves.push({
                from: sq,
                to: singleSq,
                piece: 'p',
                color: turn,
                promotion: promo
              });
            }
          } else {
            moves.push({
              from: sq,
              to: singleSq,
              piece: 'p',
              color: turn
            });

            // 2. Double forward step
            if (rank === startRank) {
              const doubleRank = rank + forward * 2;
              const doubleSq = coordsToSquare(file, doubleRank);
              if (!pos.board[doubleSq]) {
                moves.push({
                  from: sq,
                  to: doubleSq,
                  piece: 'p',
                  color: turn
                });
              }
            }
          }
        }

        // 3. Diagonal captures
        for (const df of [-1, 1]) {
          const capFile = file + df;
          if (capFile >= 0 && capFile < 8) {
            const capSq = coordsToSquare(capFile, nextRank);
            const targetPiece = pos.board[capSq];

            if (targetPiece && targetPiece.color === oppColor) {
              if (nextRank === promoRank) {
                for (const promo of PROMOTION_PIECES) {
                  moves.push({
                    from: sq,
                    to: capSq,
                    piece: 'p',
                    color: turn,
                    captured: targetPiece.type,
                    promotion: promo
                  });
                }
              } else {
                moves.push({
                  from: sq,
                  to: capSq,
                  piece: 'p',
                  color: turn,
                  captured: targetPiece.type
                });
              }
            } else if (pos.enPassantSquare !== null && capSq === pos.enPassantSquare) {
              // En Passant capture
              moves.push({
                from: sq,
                to: capSq,
                piece: 'p',
                color: turn,
                captured: 'p',
                isEnPassant: true
              });
            }
          }
        }
        break;
      }

      case 'n': {
        for (const [df, dr] of KNIGHT_OFFSETS) {
          const f = file + df;
          const r = rank + dr;
          if (f >= 0 && f < 8 && r >= 0 && r < 8) {
            const destSq = coordsToSquare(f, r);
            const destPiece = pos.board[destSq];
            if (!destPiece) {
              moves.push({ from: sq, to: destSq, piece: 'n', color: turn });
            } else if (destPiece.color === oppColor) {
              moves.push({
                from: sq,
                to: destSq,
                piece: 'n',
                color: turn,
                captured: destPiece.type
              });
            }
          }
        }
        break;
      }

      case 'b': {
        generateRayMoves(pos, sq, file, rank, DIAGONAL_DIRS, 'b', turn, oppColor, moves);
        break;
      }

      case 'r': {
        generateRayMoves(pos, sq, file, rank, ORTHOGONAL_DIRS, 'r', turn, oppColor, moves);
        break;
      }

      case 'q': {
        generateRayMoves(pos, sq, file, rank, ORTHOGONAL_DIRS, 'q', turn, oppColor, moves);
        generateRayMoves(pos, sq, file, rank, DIAGONAL_DIRS, 'q', turn, oppColor, moves);
        break;
      }

      case 'k': {
        // Standard 1-step moves
        for (const [df, dr] of KING_OFFSETS) {
          const f = file + df;
          const r = rank + dr;
          if (f >= 0 && f < 8 && r >= 0 && r < 8) {
            const destSq = coordsToSquare(f, r);
            const destPiece = pos.board[destSq];
            if (!destPiece) {
              moves.push({ from: sq, to: destSq, piece: 'k', color: turn });
            } else if (destPiece.color === oppColor) {
              moves.push({
                from: sq,
                to: destSq,
                piece: 'k',
                color: turn,
                captured: destPiece.type
              });
            }
          }
        }

        // Castling Moves
        if (turn === 'w' && sq === SQ.E1) {
          // White Kingside
          if (
            pos.castling.wK &&
            !pos.board[SQ.F1] &&
            !pos.board[SQ.G1] &&
            pos.board[SQ.H1]?.type === 'r' &&
            pos.board[SQ.H1]?.color === 'w' &&
            !isSquareAttacked(pos, SQ.E1, 'b') &&
            !isSquareAttacked(pos, SQ.F1, 'b') &&
            !isSquareAttacked(pos, SQ.G1, 'b')
          ) {
            moves.push({
              from: SQ.E1,
              to: SQ.G1,
              piece: 'k',
              color: 'w',
              isCastling: true
            });
          }

          // White Queenside
          if (
            pos.castling.wQ &&
            !pos.board[SQ.D1] &&
            !pos.board[SQ.C1] &&
            !pos.board[SQ.B1] &&
            pos.board[SQ.A1]?.type === 'r' &&
            pos.board[SQ.A1]?.color === 'w' &&
            !isSquareAttacked(pos, SQ.E1, 'b') &&
            !isSquareAttacked(pos, SQ.D1, 'b') &&
            !isSquareAttacked(pos, SQ.C1, 'b')
          ) {
            moves.push({
              from: SQ.E1,
              to: SQ.C1,
              piece: 'k',
              color: 'w',
              isCastling: true
            });
          }
        } else if (turn === 'b' && sq === SQ.E8) {
          // Black Kingside
          if (
            pos.castling.bK &&
            !pos.board[SQ.F8] &&
            !pos.board[SQ.G8] &&
            pos.board[SQ.H8]?.type === 'r' &&
            pos.board[SQ.H8]?.color === 'b' &&
            !isSquareAttacked(pos, SQ.E8, 'w') &&
            !isSquareAttacked(pos, SQ.F8, 'w') &&
            !isSquareAttacked(pos, SQ.G8, 'w')
          ) {
            moves.push({
              from: SQ.E8,
              to: SQ.G8,
              piece: 'k',
              color: 'b',
              isCastling: true
            });
          }

          // Black Queenside
          if (
            pos.castling.bQ &&
            !pos.board[SQ.D8] &&
            !pos.board[SQ.C8] &&
            !pos.board[SQ.B8] &&
            pos.board[SQ.A8]?.type === 'r' &&
            pos.board[SQ.A8]?.color === 'b' &&
            !isSquareAttacked(pos, SQ.E8, 'w') &&
            !isSquareAttacked(pos, SQ.D8, 'w') &&
            !isSquareAttacked(pos, SQ.C8, 'w')
          ) {
            moves.push({
              from: SQ.E8,
              to: SQ.C8,
              piece: 'k',
              color: 'b',
              isCastling: true
            });
          }
        }
        break;
      }
    }
  }

  return moves;
}

function generateRayMoves(
  pos: Position,
  fromSq: number,
  file: number,
  rank: number,
  dirs: number[][],
  pieceType: PieceType,
  turn: Color,
  oppColor: Color,
  outMoves: Move[]
) {
  for (const [df, dr] of dirs) {
    let f = file + df;
    let r = rank + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const destSq = coordsToSquare(f, r);
      const destPiece = pos.board[destSq];
      if (!destPiece) {
        outMoves.push({ from: fromSq, to: destSq, piece: pieceType, color: turn });
      } else {
        if (destPiece.color === oppColor) {
          outMoves.push({
            from: fromSq,
            to: destSq,
            piece: pieceType,
            color: turn,
            captured: destPiece.type
          });
        }
        break; // blocked by piece
      }
      f += df;
      r += dr;
    }
  }
}

export function generateLegalMoves(pos: Position): Move[] {
  const pseudoMoves = generatePseudoLegalMoves(pos);
  const legalMoves: Move[] = [];
  const turn = pos.turn;
  const oppColor: Color = turn === 'w' ? 'b' : 'w';

  for (const move of pseudoMoves) {
    const nextPos = applyMove(pos, move);

    // Find the King's square for the player who just moved
    let kingSq = -1;
    for (let sq = 0; sq < 64; sq++) {
      const p = nextPos.board[sq];
      if (p && p.color === turn && p.type === 'k') {
        kingSq = sq;
        break;
      }
    }

    if (kingSq !== -1 && !isSquareAttacked(nextPos, kingSq, oppColor)) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
}

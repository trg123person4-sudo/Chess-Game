import { Position, Piece, Color, CastlingRights } from './types';
import { STARTING_FEN, squareToAlgebraic, algebraicToSquare, coordsToSquare } from './constants';

export function parseFEN(fen: string = STARTING_FEN): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) {
    throw new Error(`Invalid FEN: ${fen}`);
  }

  const [piecePlacement, turnStr, castlingStr, epStr, halfmoveStr, fullmoveStr] = parts;

  const board: (Piece | null)[] = new Array(64).fill(null);
  const rows = piecePlacement.split('/');
  if (rows.length !== 8) {
    throw new Error(`Invalid FEN board rows count: ${rows.length}`);
  }

  for (let r = 0; r < 8; r++) {
    const rank = 7 - r; // rows[0] is rank 8 (index 7), rows[7] is rank 1 (index 0)
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        file += parseInt(ch, 10);
      } else {
        const isWhite = ch === ch.toUpperCase();
        const color: Color = isWhite ? 'w' : 'b';
        const type = ch.toLowerCase() as Piece['type'];
        if (file < 8) {
          board[coordsToSquare(file, rank)] = { color, type };
          file++;
        }
      }
    }
  }

  const turn: Color = turnStr === 'b' ? 'b' : 'w';

  const castling: CastlingRights = {
    wK: castlingStr.includes('K'),
    wQ: castlingStr.includes('Q'),
    bK: castlingStr.includes('k'),
    bQ: castlingStr.includes('q')
  };

  const enPassantSquare = epStr && epStr !== '-' ? algebraicToSquare(epStr) : null;
  const halfmoveClock = halfmoveStr ? parseInt(halfmoveStr, 10) : 0;
  const fullmoveNumber = fullmoveStr ? parseInt(fullmoveStr, 10) : 1;

  return {
    board,
    turn,
    castling,
    enPassantSquare: enPassantSquare !== -1 ? enPassantSquare : null,
    halfmoveClock: isNaN(halfmoveClock) ? 0 : halfmoveClock,
    fullmoveNumber: isNaN(fullmoveNumber) ? 1 : fullmoveNumber
  };
}

export function toFEN(pos: Position): string {
  const rows: string[] = [];

  for (let rank = 7; rank >= 0; rank--) {
    let emptyCount = 0;
    let rowStr = '';
    for (let file = 0; file < 8; file++) {
      const piece = pos.board[coordsToSquare(file, rank)];
      if (!piece) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount.toString();
          emptyCount = 0;
        }
        const ch = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
        rowStr += ch;
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount.toString();
    }
    rows.push(rowStr);
  }

  const piecePlacement = rows.join('/');
  const turnStr = pos.turn;

  let castlingStr = '';
  if (pos.castling.wK) castlingStr += 'K';
  if (pos.castling.wQ) castlingStr += 'Q';
  if (pos.castling.bK) castlingStr += 'k';
  if (pos.castling.bQ) castlingStr += 'q';
  if (!castlingStr) castlingStr = '-';

  const epStr = pos.enPassantSquare !== null ? squareToAlgebraic(pos.enPassantSquare) : '-';
  const halfmoveStr = pos.halfmoveClock.toString();
  const fullmoveStr = pos.fullmoveNumber.toString();

  return `${piecePlacement} ${turnStr} ${castlingStr} ${epStr} ${halfmoveStr} ${fullmoveStr}`;
}

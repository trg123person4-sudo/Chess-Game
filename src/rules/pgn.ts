export interface PgnGameData {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  result?: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  moves: string[]; // array of SAN moves
  initialFen?: string;
}

export function generatePGN(data: PgnGameData): string {
  const headers: Record<string, string> = {
    Event: data.event || 'Casual Game',
    Site: data.site || 'Local Chess App',
    Date: data.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    Round: data.round || '1',
    White: data.white || 'White',
    Black: data.black || 'Black',
    Result: data.result || '*'
  };

  if (data.initialFen) {
    headers['SetUp'] = '1';
    headers['FEN'] = data.initialFen;
  }

  let pgn = '';
  for (const [key, val] of Object.entries(headers)) {
    pgn += `[${key} "${val}"]\n`;
  }
  pgn += '\n';

  let moveText = '';
  for (let i = 0; i < data.moves.length; i++) {
    if (i % 2 === 0) {
      const moveNum = Math.floor(i / 2) + 1;
      moveText += `${moveNum}. `;
    }
    moveText += `${data.moves[i]} `;
  }

  moveText += data.result || '*';
  pgn += moveText.trim();

  return pgn;
}

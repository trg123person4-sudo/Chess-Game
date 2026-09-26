import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';

describe('FIDE Rules Integration with chess.js', () => {
  it('allows kingside and queenside castling when conditions are met', () => {
    // White can castle kingside and queenside
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const chess = new Chess(fen);

    const moves = chess.moves({ verbose: true });
    const hasKingside = moves.some((m) => m.san === 'O-O');
    const hasQueenside = moves.some((m) => m.san === 'O-O-O');

    expect(hasKingside).toBe(true);
    expect(hasQueenside).toBe(true);

    // Make kingside castling
    const moveResult = chess.move('O-O');
    expect(moveResult).toBeTruthy();
    expect(chess.get('g1')?.type).toBe('k');
    expect(chess.get('f1')?.type).toBe('r');
    expect(chess.get('e1')).toBeFalsy();
    expect(chess.get('h1')).toBeFalsy();
  });

  it('prevents castling through check (Article 3.8.b)', () => {
    // White king at e1. Black rook at f8 (5rk1) attacks f-file including f1.
    // e1 is safe, but f1 is attacked by the rook on f8!
    const fen = '5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1';
    const chess = new Chess(fen);

    const moves = chess.moves({ verbose: true });
    const hasKingside = moves.some((m) => m.san === 'O-O');
    const hasQueenside = moves.some((m) => m.san === 'O-O-O');

    expect(hasKingside).toBe(false); // f1 is attacked
    expect(hasQueenside).toBe(true);  // d1, c1, b1 are not attacked
  });

  it('executes en passant capture strictly on the immediate next turn (Article 3.7.d)', () => {
    const chess = new Chess();
    // 1. e4 e6 2. e5 d5
    chess.move('e4');
    chess.move('e6');
    chess.move('e5');
    chess.move('d5');

    // White pawn on e5 can capture d5 en passant to d6
    const moves = chess.moves({ verbose: true });
    const epMove = moves.find((m) => m.from === 'e5' && m.to === 'd6');
    expect(epMove).toBeDefined();
    expect(epMove?.flags).toContain('e'); // en passant flag

    // Make en passant move
    chess.move({ from: 'e5', to: 'd6' });
    expect(chess.get('d6')?.type).toBe('p');
    expect(chess.get('d5')).toBeFalsy(); // Black pawn captured!
  });

  it('handles pawn promotion to Q, R, B, N (Article 3.7.e)', () => {
    const fen = '8/4P3/8/8/8/8/8/4K2k w - - 0 1';
    
    // Promote to Queen
    const chessQ = new Chess(fen);
    chessQ.move({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(chessQ.get('e8')?.type).toBe('q');

    // Promote to Knight (underpromotion)
    const chessN = new Chess(fen);
    chessN.move({ from: 'e7', to: 'e8', promotion: 'n' });
    expect(chessN.get('e8')?.type).toBe('n');

    // Promote to Rook
    const chessR = new Chess(fen);
    chessR.move({ from: 'e7', to: 'e8', promotion: 'r' });
    expect(chessR.get('e8')?.type).toBe('r');

    // Promote to Bishop
    const chessB = new Chess(fen);
    chessB.move({ from: 'e7', to: 'e8', promotion: 'b' });
    expect(chessB.get('e8')?.type).toBe('b');
  });

  it('detects checkmate and stalemate (Article 5.1 & 5.2)', () => {
    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    const mateChess = new Chess();
    mateChess.move('f3');
    mateChess.move('e5');
    mateChess.move('g4');
    mateChess.move('Qh4');

    expect(mateChess.isCheckmate()).toBe(true);
    expect(mateChess.isGameOver()).toBe(true);

    // Stalemate position: Black king at a8, White queen at c7, White king at c6
    const staleChess = new Chess('k7/2Q5/2K5/8/8/8/8/8 b - - 0 1');
    expect(staleChess.isStalemate()).toBe(true);
    expect(staleChess.isGameOver()).toBe(true);
  });

  it('detects threefold repetition (Article 9.2)', () => {
    const chess = new Chess();
    // Move knights back and forth 3 times
    chess.move('Nf3'); chess.move('Nf6');
    chess.move('Ng1'); chess.move('Ng8');
    chess.move('Nf3'); chess.move('Nf6');
    chess.move('Ng1'); chess.move('Ng8');

    expect(chess.isThreefoldRepetition()).toBe(true);
    expect(chess.isDraw()).toBe(true);
  });

  it('detects fifty-move rule (Article 9.3)', () => {
    // FEN with halfmove clock at 100 (50 full moves)
    const fen = '8/5k2/8/8/8/8/5K2/8 w - - 100 51';
    const chess = new Chess(fen);
    expect(chess.isDraw()).toBe(true);
  });

  it('detects insufficient material (Article 5.2.b & 9.6)', () => {
    // King vs King
    const kvk = new Chess('8/5k2/8/8/8/8/5K2/8 w - - 0 1');
    expect(kvk.isInsufficientMaterial()).toBe(true);
    expect(kvk.isDraw()).toBe(true);

    // King & Bishop vs King
    const kbvk = new Chess('8/5k2/8/8/8/8/5K2/2B5 w - - 0 1');
    expect(kbvk.isInsufficientMaterial()).toBe(true);
    expect(kbvk.isDraw()).toBe(true);

    // King & Knight vs King
    const knvk = new Chess('8/5k2/8/8/8/8/5K2/2N5 w - - 0 1');
    expect(knvk.isInsufficientMaterial()).toBe(true);
    expect(knvk.isDraw()).toBe(true);
  });
});

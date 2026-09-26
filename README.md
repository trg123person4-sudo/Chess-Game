# Grandmaster Chess Engine ♟️

A high-performance single-player chess web application featuring a custom-built TypeScript chess engine with calibrated difficulty scaling, running isolated in a Web Worker.

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)
![React](https://img.shields.io/badge/React-18.3-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-5.4-646cff.svg)
![Vitest](https://img.shields.io/badge/Vitest-2.0-yellow.svg)

---

## 🌟 Features

- **Custom-Built Minimax Engine**:
  - Alpha-Beta pruning with check extensions
  - Iterative deepening with strict time budgeting
  - Move ordering with MVV-LVA, Killer Moves, and History Heuristic
  - 64-bit Zobrist Transposition Table (TT) caching
  - Quiescence search with delta pruning to eliminate the horizon effect
  - Comprehensive positional evaluation: Tapered Piece-Square Tables (PST), King safety & pawn shield analysis, pawn structure (doubled/isolated/passed pawns), and mobility scoring
- **Web Worker Architecture**:
  - Engine searches run strictly off the main UI thread via `postMessage`.
  - The UI maintains 60fps responsiveness with zero page freezing.
- **10 Calibrated Skill Tiers (600 to 2500 Elo)**:
  - Multi-knob scaling: Depth, time budget, softmax Boltzmann temperature selection over top candidate moves, and positional weighting.
  - Lower levels play natural, plausible candidate moves instead of erratic blunders.
- **Engine Personalities**:
  - Select between **Balanced**, **Aggressive** (attacks enemy king), and **Positional** (pawn structure and piece placement).
- **Full Game Experience**:
  - Interactive board with click-to-move and drag-and-drop
  - Legal move indicators, check highlights, last-move tracking
  - Pawn promotion picker modal (Queen, Rook, Bishop, Knight)
  - Zero-latency sound effects synthesized via the native Web Audio API
  - Dual chess clocks (Unlimited, Blitz 3+2, Blitz 5+0, Rapid 10+0, Rapid 15+10)
  - Move history viewer in Standard Algebraic Notation (SAN)
  - Game controls: New Game, Undo (synchronized with engine), Resign, Offer Draw, Flip Board
  - FEN / PGN Import & Export modal
  - Auto-save and resume via `localStorage`
- **Post-Game Analysis & Blunder Detection**:
  - Automatic centipawn loss calculation for every move
  - Flags Blunders (??), Mistakes (?), and Inaccuracies (?!)
  - Recommends the engine's preferred moves and Principal Variations (PV)
- **Extra Modes**:
  - **Tactical Puzzles**: Interactive curated tactics trainer
  - **Stats Tracker**: Persistent win/loss/draw records per skill level

---

## 🚀 Quickstart

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation & Run

```bash
# Navigate to the project directory
cd chess-engine

# Install dependencies
npm install

# Start the Vite development server
npm run dev

# Run the complete automated test suite
npm run test

# Build for production
npm run build
```

---

## 🧠 Skill Level Table

| Level | Name | Target Elo | Max Depth | Time Budget | Selection Model |
|---|---|---|---|---|---|
| **1** | Beginner | ~600 | 1–2 | 120ms | Temp $T=2.2$, candidates within 350cp |
| **2** | Novice | ~850 | 2 | 200ms | Temp $T=1.6$, candidates within 250cp |
| **3** | Casual | ~1100 | 2–3 | 350ms | Temp $T=1.1$, candidates within 180cp |
| **4** | Intermediate | ~1300 | 3 | 500ms | Temp $T=0.75$, candidates within 120cp |
| **5** | Club Player | ~1500 | 4 | 800ms | Temp $T=0.45$, candidates within 80cp |
| **6** | Advanced | ~1700 | 5 | 1200ms | Temp $T=0.25$, candidates within 50cp |
| **7** | Strong | ~1900 | 6 | 1800ms | Temp $T=0.12$, candidates within 35cp |
| **8** | Expert | ~2100 | 7 | 2500ms | Temp $T=0.04$, nearly strict best |
| **9** | Master | ~2300 | 8 | 3500ms | Temp $T=0.0$, strictly best move |
| **10** | Grandmaster | ~2500 | 12 | 5000ms | Temp $T=0.0$, full calculation |

---

## 🏗️ Project Architecture

```
chess-engine/
├── src/
│   ├── types/               # TypeScript interfaces for Chess and Engine
│   ├── engine/
│   │   ├── constants.ts     # Material weights & Piece-Square Tables (PST)
│   │   ├── zobrist.ts       # 64-bit Zobrist position hashing
│   │   ├── transposition.ts # Cache table with Exact/Lower/Upper bounds
│   │   ├── moveOrdering.ts  # MVV-LVA, Killer Moves, History Heuristic
│   │   ├── evaluation.ts    # Positional evaluation & game phase interpolation
│   │   ├── search.ts        # Iterative deepening, alpha-beta, quiescence
│   │   ├── skillLevels.ts   # 10 calibrated difficulty tiers
│   │   └── worker.ts        # Web Worker entry point
│   ├── audio/
│   │   └── soundEffects.ts  # Web Audio API synthesizers
│   ├── hooks/
│   │   ├── useChessGame.ts  # Master game loop & state manager
│   │   ├── useEngineWorker.ts # Web Worker bridge hook
│   │   └── useChessClock.ts # Dual timer clock hook
│   ├── components/
│   │   ├── Board/           # ChessBoard, Square, PieceIcons, PromotionModal
│   │   ├── Controls/        # GameControls, SkillSelector, ClockDisplay, PgnFenModal
│   │   ├── History/         # MoveHistory, EvalBar
│   │   ├── Analysis/        # PostGameModal
│   │   └── Extras/          # StatsTracker, PuzzleMode
│   ├── App.tsx              # Main UI application layout
│   └── main.tsx             # DOM entry
├── tests/
│   ├── rules.test.ts        # FIDE rules verification (castling, en passant, promotion, draws)
│   ├── engine.test.ts       # Tactical mates & piece forks
│   ├── timeBudget.test.ts   # Strict time budget adherence
│   └── skillLevel.test.ts   # Level 10 vs Level 1 automated benchmark
└── docs/
    └── ARCHITECTURE.md      # Detailed technical architecture guide
```

---

## 📌 Assumptions & Defaults

- **Rules & Move Generation**: Uses `chess.js` for legal move generation, FIDE draw detection (threefold repetition, 50-move rule, insufficient material, stalemate), castling, en passant, and promotions.
- **Audio**: Synthesized using browser Web Audio API oscillator nodes for instant offline reliability without external assets.
- **Single-Player**: Designed for human vs engine matches. Save/resume persists locally in `localStorage`.

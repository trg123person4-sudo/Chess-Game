# Architecture & Technical Design: Grandmaster Chess Engine

## 1. System Overview

Grandmaster Chess Engine is a high-performance single-player chess web application built entirely with TypeScript, React, and Vite. The search and evaluation engines run inside a dedicated Web Worker off the main UI thread, ensuring fluid 60fps animations, instant UI responsiveness, and zero freezing even during deep multi-ply calculations.

```
┌──────────────────────────────────────────────────────────┐
│                   React UI Layer                         │
│  - ChessBoard (SVG Piece render, drag & drop, highlights)│
│  - ClockDisplay (Dual timers, blitz/rapid/unlimited)     │
│  - MoveHistory & EvalBar (SAN list, blunder badges)      │
│  - PostGameModal (Centipawn blunder analysis & PV review)│
│  - SoundManager (Web Audio API synthesizer)              │
│  - StatsTracker & PuzzleMode (LocalStorage records)      │
└───────────────────────────┬──────────────────────────────┘
                            │ postMessage (Inbound / Outbound)
┌───────────────────────────▼──────────────────────────────┐
│                Dedicated Web Worker                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                   ChessSearcher                    │  │
│  │  - Iterative Deepening loop                        │  │
│  │  - Minimax with Alpha-Beta Pruning                 │  │
│  │  - Quiescence Search with Delta Pruning            │  │
│  │  - Softmax Candidate Selection for Skill Levels    │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│       ┌─────────────────┼──────────────────┐             │
│       ▼                 ▼                  ▼             │
│  ┌──────────┐    ┌──────────────┐   ┌─────────────┐      │
│  │ Zobrist  │    │ Transposition│   │ MoveOrderer │      │
│  │ Hashing  │    │ Table (TT)   │   │ - MVV-LVA   │      │
│  └──────────┘    └──────────────┘   │ - Killer    │      │
│                                     │ - History   │      │
│                                     └─────────────┘      │
│                         │                                │
│                         ▼                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │               Evaluation Function                  │  │
│  │  - Material Balance (P:100, N:320, B:330, R:500...)│  │
│  │  - Tapered Piece-Square Tables (Phase Interpolation│  │
│  │  - King Safety (Pawn shields, open file penalties) │  │
│  │  - Pawn Structure (Doubled, isolated, passed pawns)│  │
│  │  - Piece Mobility (Legal moves proxy)              │  │
│  │  - Engine Personalities (Aggressive / Positional)  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Knob Skill Level Calibration

Traditional chess bots often simulate beginner play by randomly blundering or cutting search depth. In contrast, our engine uses a 3-knob model:
1. **Search Depth & Time Budget**: Controls tactical lookahead horizon.
2. **Move Selection Noise / Softmax**: Rather than playing the single highest centipawn move, lower levels evaluate the position, extract the top candidates, and pick according to Boltzmann distribution:
   $$P(\text{move}) \propto \exp\left(\frac{\text{score} - \text{maxScore}}{T \times 100}\right)$$
   Where $T$ is temperature. This ensures lower levels play natural, plausible candidate moves without catastrophic random spasms.
3. **Positional Weighting**: At beginner levels, complex positional factors (pawn structure, king safety) are damped down ($15\% \to 100\%$), simulating how novice players focus mostly on immediate captures.

| Level | Name | Elo | Max Depth | Time Budget | Selection Model |
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
| **10** | Grandmaster | ~2500 | 12 | 5000ms | Temp $T=0.0$, maximum calculation |

---

## 3. Search Engine Components

- **Iterative Deepening**: Searches depth 1, then depth 2, depth 3... If the time budget expires mid-search, the engine gracefully aborts the incomplete iteration and returns the best move from the last fully completed depth.
- **Move Ordering**:
  - Hash move from Transposition Table (+1,000,000)
  - MVV-LVA for captures (+100,000 + Victim $\times 10$ - Attacker)
  - Pawn promotions (+90,000)
  - Killer moves (2 per ply for non-captures causing beta cutoffs)
  - History heuristic table [64][64]
- **Quiescence Search**: Extends search at leaf nodes across captures and promotions with delta pruning, preventing the horizon effect.
- **Zobrist Transposition Table**: 64-bit position hashing across piece positions, castling rights, en passant, and side to move, storing Exact, Lowerbound, and Upperbound bounds.

---

## 4. Audio Engine

The app uses the Web Audio API to synthesize wood-snap piece drops, captures, check chime alerts, and game conclusion chords dynamically without external sound files. This guarantees 100% offline availability and zero audio network latency.

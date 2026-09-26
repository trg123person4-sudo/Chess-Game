export type TTFlag = 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';

export interface TTEntry {
  hash: bigint;
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove: string; // UCI format e.g. "e2e4" or SAN
}

export class TranspositionTable {
  private table: Map<bigint, TTEntry>;
  private readonly maxSize: number;

  constructor(maxEntries = 250000) {
    this.table = new Map();
    this.maxSize = maxEntries;
  }

  get(hash: bigint): TTEntry | undefined {
    return this.table.get(hash);
  }

  set(hash: bigint, entry: TTEntry): void {
    if (this.table.size >= this.maxSize) {
      // Simple FIFO eviction of oldest items when table fills
      const firstKey = this.table.keys().next().value;
      if (firstKey !== undefined) {
        this.table.delete(firstKey);
      }
    }
    this.table.set(hash, entry);
  }

  clear(): void {
    this.table.clear();
  }

  size(): number {
    return this.table.size;
  }
}

export const globalTT = new TranspositionTable();

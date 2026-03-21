/**
 * Shared types for the pool-break replay system.
 *
 * Wire format matches the JSON produced by roundgen/internal/export/export.go.
 * Keep in sync with RoundJSON there.
 */

/** One position snapshot.
 *  Layout: [tMs, cueX, cueY, b1X, b1Y, b2X, b2Y, …, b15X, b15Y]
 *  Pocketed balls use 0,0 as sentinel.
 *  Length is always SAMPLE_STRIDE (33).
 */
export type Sample = number[];

export const SAMPLE_STRIDE = 33; // 1 (tMs) + 2 (cue) + 15×2 (object balls)

/** Wire format of a single round JSON file. */
export interface RoundData {
  /** PRNG seed used to generate this round. */
  seed: number;
  /** Ball config: bc[slot] = ballId (1–15). Slot 0 = apex. */
  bc: [number, number, number, number, number, number, number, number, number,
       number, number, number, number, number, number];
  /** Cue ball spawn position. */
  cueX: number;
  cueY: number;
  /** Position samples, one every ~33 ms (~2 physics frames at 60 Hz). */
  s: Sample[];
  /** Pocket events in chronological order. */
  pe: Array<{ t: number; b: number; p: number }>; // tMs, ballId, pocketId
  /** Ball ID of first object ball pocketed (1–15), or -1 if none. */
  firstBall: number;
  /** Pocket ID of first object ball pocketed (-1 if none). */
  firstPock: number;
}

/** One line in public/data/index.json */
export interface IndexEntry {
  file: string;
  firstBall: number; // -1 if no object ball pocketed
  firstPock: number;
}

/** The parsed dataset index. */
export interface DatasetIndex {
  entries: IndexEntry[];
}

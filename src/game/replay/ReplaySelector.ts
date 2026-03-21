/**
 * ReplaySelector
 *
 * Given a target outcome (ball ID 1–15) and the dataset index, picks a
 * random replay whose firstBall matches.  Guarantees the same file is not
 * re-used consecutively (simple anti-repeat).
 */

import { type IndexEntry } from './ReplayTypes';

export class ReplaySelector {
  /** Most recently used file per outcome bucket, to avoid instant repeats. */
  private lastUsed = new Map<number, string>();

  /**
   * Pick a replay filename for the given target ball ID.
   * Throws if the index has no matching entry.
   */
  pick(targetBall: number, index: IndexEntry[]): string {
    const candidates = index.filter(e => e.firstBall === targetBall);
    if (candidates.length === 0) {
      throw new Error(`No replay in dataset for firstBall=${targetBall}`);
    }

    // Prefer not repeating the last used file for this outcome.
    const last = this.lastUsed.get(targetBall);
    const eligible = candidates.length > 1
      ? candidates.filter(e => e.file !== last)
      : candidates;

    const entry = eligible[Math.floor(Math.random() * eligible.length)];
    this.lastUsed.set(targetBall, entry.file);
    return entry.file;
  }
}

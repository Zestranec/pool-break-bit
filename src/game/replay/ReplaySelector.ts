/**
 * ReplaySelector — diversity-aware replay picker.
 *
 * Selection flow:
 *   1. Caller has already determined the target outcome bucket (ball ID 0–15)
 *      via the probability / RTP layer — that decision is final and untouched.
 *   2. Filter the index to candidates matching that bucket.
 *   3. Score each candidate using ReplayDiversityScorer (history penalties).
 *   4. Pick uniformly from the top-N highest-scored candidates.
 *   5. Record the chosen replay in history so the next call is influenced.
 *
 * RTP is fully isolated: diversity logic never crosses bucket boundaries.
 */

import { type IndexEntry } from './ReplayTypes';
import { ReplayDiversityScorer, type HistoryEntry } from './ReplayDiversity';

/** Set to true in development to log per-round selection details. */
const DEBUG = false;

// Human-readable labels for debug output only.
const POCKET_NAMES   = ['TL', 'LM', 'TR', 'BL', 'RM', 'BR'] as const;
const PRESET_NAMES   = [
  'apex-center', 'apex-left', 'apex-right',
  'seam-left',   'seam-right',
  'deep-left',   'deep-right',
] as const;
const REGION_NAMES   = ['left', 'center', 'right'] as const;

export class ReplaySelector {
  private readonly diversity = new ReplayDiversityScorer();

  /**
   * Pick a replay filename for the given target ball ID.
   * Throws if the index has no matching entry.
   */
  pick(targetBall: number, index: IndexEntry[]): string {
    const candidates = index.filter(e => e.firstBall === targetBall);
    if (candidates.length === 0) {
      throw new Error(`No replay in dataset for firstBall=${targetBall}`);
    }

    // Score and rank candidates by diversity relative to recent history.
    const scored = this.diversity.score(candidates);
    const chosen = this.diversity.pickFromScored(scored);

    // Record the selection so future calls are penalised for repeating it.
    const histEntry: HistoryEntry = {
      file:      chosen.file,
      firstPock: chosen.firstPock,
      bpid:      chosen.bpid,
      cueRegion: chosen.cueRegion,
    };
    this.diversity.record(histEntry);

    if (DEBUG) this._log(targetBall, candidates.length, scored, chosen);

    return chosen.file;
  }

  // ── Debug logging ─────────────────────────────────────────────────────────

  private _log(
    targetBall:  number,
    bucketSize:  number,
    scored:      ReturnType<ReplayDiversityScorer['score']>,
    chosen:      IndexEntry,
  ): void {
    const pn = (id: number) => POCKET_NAMES[id]  ?? String(id);
    const rn = (id: number) => REGION_NAMES[id]  ?? String(id);
    const bn = (id: number) => PRESET_NAMES[id]  ?? String(id);

    console.groupCollapsed(
      `[ReplaySelector] bucket=${targetBall}  candidates=${bucketSize}  → ${chosen.file}`,
    );
    console.log(`  pocket:  ${pn(chosen.firstPock)}   preset: ${bn(chosen.bpid)}   region: ${rn(chosen.cueRegion)}`);
    console.log('  top scores:');
    scored.slice(0, Math.min(5, scored.length)).forEach(({ entry, score }, i) => {
      const marker = entry.file === chosen.file ? ' ◀' : '';
      console.log(`    #${i + 1} ${entry.file}  ${score.toFixed(1)}${marker}`);
    });
    const history = this.diversity.snapshot;
    if (history.length) {
      console.log(`  history (last ${history.length}):`);
      history.forEach((h, i) => {
        console.log(`    -${i + 1}: ${h.file}  pock=${pn(h.firstPock)}  preset=${bn(h.bpid)}  region=${rn(h.cueRegion)}`);
      });
    }
    console.groupEnd();
  }
}

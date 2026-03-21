/**
 * ReplayDiversity — diversity-aware scoring for replay selection.
 *
 * Keeps a rolling history of recently shown rounds and penalises candidates
 * that share visual features with recent selections.
 *
 * ── RTP isolation ────────────────────────────────────────────────────────────
 * This module operates ONLY inside an already-chosen outcome bucket.
 * It never changes which bucket is selected; the RTP model is upstream.
 * Diversity filtering is purely a within-bucket ranking pass.
 *
 * ── Scoring ──────────────────────────────────────────────────────────────────
 * Each candidate starts from BASE_SCORE.  For every entry in the rolling
 * history, penalties proportional to visual similarity are subtracted.
 * Older history entries have less influence (exponential decay).
 * A small random jitter breaks ties unpredictably.
 *
 * ── Selection ────────────────────────────────────────────────────────────────
 * Candidates are sorted descending by score.  One is chosen uniformly at
 * random from the top-N highest-scored candidates, preserving some
 * unpredictability while still strongly preferring diverse replays.
 */

import { type IndexEntry } from './ReplayTypes';

// ── Tuning constants ──────────────────────────────────────────────────────────

/** Rolling window of recent rounds tracked globally (all outcome buckets). */
const HISTORY_SIZE = 10;

/**
 * After scoring, pick uniformly from the top-N candidates.
 * 3 gives good variety while still favouring the highest-scoring replays.
 */
const TOP_N = 3;

/** Exponential decay base per history position (newest = position 0). */
const DECAY = 0.72;

/** Penalty weights.  Tune these without touching anything else. */
const P = {
  /** Near-ban: same replay file appeared in recent history. */
  sameFile:      120,
  /** Same first-pocket destination (visual repeat: same ball travels same path). */
  samePocket:     35,
  /** Same break-target preset (visual repeat: similar cue-ball trajectory). */
  samePreset:     22,
  /** Same cue spawn region (cue appears from same part of the table). */
  sameCueRegion:  14,
} as const;

const BASE_SCORE  = 60;
const JITTER_MAX  = 12; // max random bonus added for tie-breaking

// ── Types ─────────────────────────────────────────────────────────────────────

/** Compact representation of a recently shown round, stored in the history. */
export interface HistoryEntry {
  file:      string;
  firstPock: number; // pocket ID of first ball pocketed
  bpid:      number; // break-target preset ID
  cueRegion: number; // 0=left, 1=center, 2=right
}

export interface ScoredCandidate {
  entry: IndexEntry;
  score: number;
}

// ── ReplayDiversityScorer ─────────────────────────────────────────────────────

export class ReplayDiversityScorer {
  private history: HistoryEntry[] = [];

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record a just-played round into the rolling history.
   * Call this immediately after selection so the next call sees it.
   */
  record(entry: HistoryEntry): void {
    this.history.unshift(entry);                       // newest first
    if (this.history.length > HISTORY_SIZE) this.history.pop();
  }

  /**
   * Score every candidate in the chosen outcome bucket and sort descending.
   * The caller should then use `pickFromScored` to make the final choice.
   */
  score(candidates: IndexEntry[]): ScoredCandidate[] {
    return candidates
      .map(entry => ({ entry, score: this._scoreOne(entry) }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Pick one candidate uniformly from the top-N highest-scored entries.
   * Falls back gracefully when fewer than TOP_N candidates exist.
   */
  pickFromScored(scored: ScoredCandidate[]): IndexEntry {
    const pool = scored.slice(0, Math.min(TOP_N, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].entry;
  }

  /** Read-only snapshot of the current history (newest first). */
  get snapshot(): readonly HistoryEntry[] {
    return this.history;
  }

  // ── Scoring internals ──────────────────────────────────────────────────────

  private _scoreOne(candidate: IndexEntry): number {
    let score = BASE_SCORE;

    for (let i = 0; i < this.history.length; i++) {
      const h     = this.history[i];
      const decay = Math.pow(DECAY, i); // 1.0, 0.72, 0.52, 0.37 …

      // Same replay file: hard penalty regardless of decay — this is the
      // strongest signal that the round would look visually identical.
      if (candidate.file === h.file) score -= P.sameFile;

      // Soft penalties decay with history age.
      if (candidate.firstPock  === h.firstPock)  score -= P.samePocket    * decay;
      if (candidate.bpid       === h.bpid)       score -= P.samePreset    * decay;
      if (candidate.cueRegion  === h.cueRegion)  score -= P.sameCueRegion * decay;
    }

    score += Math.random() * JITTER_MAX; // tie-breaker
    return score;
  }
}

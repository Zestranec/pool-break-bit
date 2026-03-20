/**
 * Paytable & RTP maths
 * ─────────────────────────────────────────────────────────────────────────────
 * There are 8 balls. In Version 1 all balls have equal win probability:
 *
 *   P(win) = 1/8 = 0.125  (12.5%)
 *
 * Target RTP = 95 %
 *
 *   RTP  = P(win) × payout_multiplier
 *   0.95 = 0.125  × payout_multiplier
 *   payout_multiplier = 0.95 / 0.125 = 7.60
 *
 * So if the player bets B and their ball wins, they receive B × 7.60.
 * Net profit on a win = B × 6.60.
 *
 * House edge = 1 − RTP = 5 %
 *
 * Each ball independently owns its probability & multiplier so per-ball
 * weighting can be introduced in Version 2 without changing caller code.
 */

export interface BallPayEntry {
  ballId: number;           // 1-indexed
  winProbability: number;   // 0-1
  payoutMultiplier: number; // full-return multiplier (includes stake return)
}

/** Equal-odds paytable for 8 balls. */
export const PAYTABLE: BallPayEntry[] = Array.from({ length: 8 }, (_, i) => ({
  ballId:           i + 1,
  winProbability:   1 / 8,
  payoutMultiplier: 7.6,
}));

/** Lookup by ballId (1-indexed). */
export function getPayEntry(ballId: number): BallPayEntry {
  const entry = PAYTABLE.find(e => e.ballId === ballId);
  if (!entry) throw new Error(`No paytable entry for ballId ${ballId}`);
  return entry;
}

/** Available bet denominations. */
export const BET_OPTIONS = [10, 20, 50, 100] as const;
export type BetAmount = typeof BET_OPTIONS[number];

export const DEFAULT_BET:     BetAmount = 10;
export const STARTING_BALANCE = 1000;

/**
 * Betting configuration — roulette-inspired 17-outcome model.
 *
 * Outcome space (17 results, equal probability 1/17 each):
 *   1–7    solid balls
 *   8      black / 8-ball  (belongs to Low, High, and Even)
 *   9–15   stripe balls
 *   16     cue ball scratch / zero
 *   17     house result — no player bet wins (pure house-edge slot)
 *
 * Outside bet coverage:
 *   Low    1–8   (8 outcomes)
 *   High   8–15  (8 outcomes; 8 shared with Low)
 *   Odd    1,3,5,7,9,11,13,15  (8 outcomes)
 *   Even   2,4,6,8,10,12,14   (7 outcomes; 8 counts as even)
 *
 * Payout formula:
 *   fair_total_return = 17 / covered_count
 *   rtp_total_return  = fair_total_return × 0.95
 *
 * Expected total-return multipliers at 95 % RTP:
 *   Single ball / Cue : 17/1  × 0.95 = 16.15
 *   Low / High / Odd  : 17/8  × 0.95 = 2.01875
 *   Even  (7 covered) : 17/7  × 0.95 ≈ 2.30714
 */

export const TOTAL_OUTCOMES = 17;
export const TARGET_RTP     = 0.95;

// ─── Bet key type ─────────────────────────────────────────────────────────────
export type BetKey =
  | 'ball-1'  | 'ball-2'  | 'ball-3'  | 'ball-4'  | 'ball-5'
  | 'ball-6'  | 'ball-7'  | 'ball-8'  | 'ball-9'  | 'ball-10'
  | 'ball-11' | 'ball-12' | 'ball-13' | 'ball-14' | 'ball-15'
  | 'cue'
  | 'low' | 'high' | 'odd' | 'even';

export interface BetDef {
  key:              BetKey;
  label:            string;       // short display label
  sublabel?:        string;       // e.g. "1–8" for Low
  /** Outcome IDs (1–17) that win this bet. */
  coveredResults:   readonly number[];
  /** Full return multiplier including stake (e.g. 16.15 = win 15.15 + stake back). */
  payoutMultiplier: number;
}

function rtp(covered: readonly number[]): number {
  return (TOTAL_OUTCOMES / covered.length) * TARGET_RTP;
}

const LOW_RESULTS    = [1, 2, 3, 4, 5, 6, 7, 8]       as const;
const HIGH_RESULTS   = [8, 9, 10, 11, 12, 13, 14, 15]  as const;
const ODD_RESULTS    = [1, 3, 5, 7, 9, 11, 13, 15]     as const;
const EVEN_RESULTS   = [2, 4, 6, 8, 10, 12, 14]        as const;

// ─── All bet definitions ──────────────────────────────────────────────────────
export const BET_DEFS: ReadonlyMap<BetKey, BetDef> = new Map([
  // Single-ball bets for each object ball (1-15)
  ...Array.from({ length: 15 }, (_, i): [BetKey, BetDef] => {
    const n   = i + 1;
    const key = `ball-${n}` as BetKey;
    return [key, {
      key,
      label:            String(n),
      coveredResults:   [n],
      payoutMultiplier: rtp([n]),
    }];
  }),

  // Cue ball / zero (outcome ID = 16)
  ['cue', {
    key:              'cue',
    label:            '0',
    sublabel:         'CUE',
    coveredResults:   [16],
    payoutMultiplier: rtp([16]),
  }],

  // Outside bets
  ['low', {
    key:              'low',
    label:            'LOW',
    sublabel:         '1–8',
    coveredResults:   LOW_RESULTS,
    payoutMultiplier: rtp(LOW_RESULTS),
  }],
  ['high', {
    key:              'high',
    label:            'HIGH',
    sublabel:         '8–15',
    coveredResults:   HIGH_RESULTS,
    payoutMultiplier: rtp(HIGH_RESULTS),
  }],
  ['odd', {
    key:              'odd',
    label:            'ODD',
    coveredResults:   ODD_RESULTS,
    payoutMultiplier: rtp(ODD_RESULTS),
  }],
  ['even', {
    key:              'even',
    label:            'EVEN',
    coveredResults:   EVEN_RESULTS,
    payoutMultiplier: rtp(EVEN_RESULTS),
  }],
]);

export function getBetDef(key: BetKey): BetDef {
  const def = BET_DEFS.get(key);
  if (!def) throw new Error(`Unknown bet key: ${key}`);
  return def;
}

/** Available bet denominations. */
export const BET_OPTIONS = [10, 20, 50, 100] as const;
export type BetAmount = typeof BET_OPTIONS[number];

export const DEFAULT_BET:     BetAmount = 10;
export const STARTING_BALANCE = 1000;

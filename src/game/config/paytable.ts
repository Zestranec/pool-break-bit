/**
 * Betting configuration — 15-outcome pool-break model.
 *
 * Outcome space (15 equal outcomes):
 *   1–7   solid balls   (ball IDs 1–7)
 *   8     8-ball        (ball ID 8)
 *   9–15  stripe balls  (ball IDs 9–15)
 *
 * Outside bet coverage:
 *   Low   1–7   (7 balls, all solids)
 *   High  9–15  (7 balls, all stripes)
 *   Odd   1,3,5,7,9,11,13,15  (8 balls)
 *   Even  2,4,6,8,10,12,14    (7 balls; 8-ball counts as even)
 *
 * Payout formula:
 *   multiplier = (15 / covered_count) × 0.95
 *
 * EV = (N/15) × (15/N × 0.95) = 0.95  →  RTP = 95 % regardless of N ✓
 */

export const TOTAL_OUTCOMES = 15;
export const TARGET_RTP     = 0.95;

// ─── Bet key type ─────────────────────────────────────────────────────────────
export type BetKey =
  | 'ball-1'  | 'ball-2'  | 'ball-3'  | 'ball-4'  | 'ball-5'
  | 'ball-6'  | 'ball-7'  | 'ball-8'  | 'ball-9'  | 'ball-10'
  | 'ball-11' | 'ball-12' | 'ball-13' | 'ball-14' | 'ball-15'
  | 'low' | 'high' | 'odd' | 'even';

export interface BetDef {
  key:              BetKey;
  label:            string;
  sublabel?:        string;
  /** Ball IDs (1–15) that win this bet. */
  balls:            readonly number[];
  /** Full return multiplier including stake. */
  payoutMultiplier: number;
}

function rtp(balls: readonly number[]): number {
  return (TOTAL_OUTCOMES / balls.length) * TARGET_RTP;
}

const LOW_BALLS  = [1, 2, 3, 4, 5, 6, 7]              as const;
const HIGH_BALLS = [9, 10, 11, 12, 13, 14, 15]         as const;
const ODD_BALLS  = [1, 3, 5, 7, 9, 11, 13, 15]         as const;
const EVEN_BALLS = [2, 4, 6, 8, 10, 12, 14]            as const;

// ─── All bet definitions ──────────────────────────────────────────────────────
export const BET_DEFS: ReadonlyMap<BetKey, BetDef> = new Map([
  // Single-ball bets
  ...Array.from({ length: 15 }, (_, i): [BetKey, BetDef] => {
    const n   = i + 1;
    const key = `ball-${n}` as BetKey;
    return [key, {
      key,
      label:            String(n),
      balls:            [n],
      payoutMultiplier: rtp([n]),
    }];
  }),

  // Outside bets
  ['low', {
    key:              'low',
    label:            'LOW',
    sublabel:         '1–7',
    balls:            LOW_BALLS,
    payoutMultiplier: rtp(LOW_BALLS),
  }],
  ['high', {
    key:              'high',
    label:            'HIGH',
    sublabel:         '9–15',
    balls:            HIGH_BALLS,
    payoutMultiplier: rtp(HIGH_BALLS),
  }],
  ['odd', {
    key:              'odd',
    label:            'ODD',
    sublabel:         '1,3,5…',
    balls:            ODD_BALLS,
    payoutMultiplier: rtp(ODD_BALLS),
  }],
  ['even', {
    key:              'even',
    label:            'EVEN',
    sublabel:         '2,4,6…',
    balls:            EVEN_BALLS,
    payoutMultiplier: rtp(EVEN_BALLS),
  }],
]);

/** Look up a bet definition by key. Accepts string | null for convenience. */
export function getBetDef(key: string | null): BetDef | undefined {
  if (!key) return undefined;
  return BET_DEFS.get(key as BetKey);
}

/** Available bet denominations. */
export const BET_OPTIONS = [10, 20, 50, 100] as const;
export type BetAmount = typeof BET_OPTIONS[number];

export const DEFAULT_BET:     BetAmount = 10;
export const STARTING_BALANCE = 1000;

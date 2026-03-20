/**
 * RTP Simulation — run with:  npm run sim
 *
 * Verifies hit rate and simulated RTP for all supported bet types
 * against the 17-outcome model at 95 % target RTP.
 *
 *   Outcome space: 17 equal-probability results (1/17 each)
 *   House edge:    5 %  (outcome 17 is unbeatable)
 *
 *   Expected total-return multipliers:
 *     Single (1 covered) :  17/1  × 0.95 = 16.15    hit = 1/17 ≈  5.88 %
 *     Low / High / Odd   :  17/8  × 0.95 = 2.01875  hit = 8/17 ≈ 47.06 %
 *     Even (7 covered)   :  17/7  × 0.95 ≈ 2.30714  hit = 7/17 ≈ 41.18 %
 */

import { ProbabilityController } from '../controllers/ProbabilityController';
import { OutcomeController }      from '../controllers/OutcomeController';
import { BET_DEFS, BetKey }       from '../config/paytable';

const ROUNDS_PER_BET = 1_000_000;
const BET            = 1;          // normalise to 1 unit
const TOLERANCE      = 0.010;      // ±1.0 % allowed deviation from 95 % RTP (single bets have σ≈0.38 %)

// Representative keys to simulate (one per logical bet type)
const BET_KEYS_TO_TEST: BetKey[] = [
  'ball-1',   // single ball (representative — all 16 single bets are identical math)
  'cue',      // single cue (same math as ball)
  'low',      // Low 1–8
  'high',     // High 8–15
  'odd',      // Odd 1,3,5,7,9,11,13,15
  'even',     // Even 2,4,6,8,10,12,14
];

interface SimResult {
  key:          BetKey;
  label:        string;
  covered:      number;
  expectedRTP:  number;
  simulatedRTP: number;
  hitRate:      number;
  pass:         boolean;
}

function simulate(key: BetKey): SimResult {
  const def   = BET_DEFS.get(key)!;
  const rng   = ProbabilityController.fresh();

  let totalBet    = 0;
  let totalReturn = 0;
  let wins        = 0;

  for (let i = 0; i < ROUNDS_PER_BET; i++) {
    const outcome   = OutcomeController.resolve(key, rng);
    totalBet       += BET;
    totalReturn    += outcome.isWin ? BET * outcome.payoutMultiplier : 0;
    if (outcome.isWin) wins++;
  }

  const simulatedRTP = totalReturn / totalBet;
  return {
    key,
    label:        def.label + (def.sublabel ? ` (${def.sublabel})` : ''),
    covered:      def.coveredResults.length,
    expectedRTP:  def.payoutMultiplier * (def.coveredResults.length / 17),
    simulatedRTP,
    hitRate:      wins / ROUNDS_PER_BET,
    pass:         Math.abs(simulatedRTP - 0.95) <= TOLERANCE,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('──────────────────────────────────────────────────────────');
console.log('  Pool Break Bet — RTP Simulation  (17-outcome model)');
console.log('──────────────────────────────────────────────────────────');
console.log(`  Rounds per bet type : ${ROUNDS_PER_BET.toLocaleString()}`);
console.log('──────────────────────────────────────────────────────────');

const results: SimResult[] = BET_KEYS_TO_TEST.map(simulate);

let allPass = true;
for (const r of results) {
  const rtpStr  = (r.simulatedRTP  * 100).toFixed(3);
  const hitStr  = (r.hitRate       * 100).toFixed(3);
  const expStr  = (r.expectedRTP   * 100).toFixed(3);
  const status  = r.pass ? '✓' : '✗';
  console.log(
    `  [${status}] ${r.label.padEnd(14)} ` +
    `covered=${String(r.covered).padStart(2)}  ` +
    `hit=${hitStr.padStart(7)} %  ` +
    `RTP=${rtpStr.padStart(7)} %  (expected ${expStr} %)`,
  );
  if (!r.pass) allPass = false;
}

console.log('──────────────────────────────────────────────────────────');
if (allPass) {
  console.log('  All bet types within ±1.0 % RTP tolerance. ✓');
} else {
  console.error('  One or more bet types outside RTP tolerance! ✗');
  process.exit(1);
}

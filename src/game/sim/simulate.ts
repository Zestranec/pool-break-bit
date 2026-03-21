/**
 * RTP Simulation — run with:  npm run sim
 *
 * Verifies hit rate and simulated RTP for all supported bet types
 * against the 16-outcome model at 95 % target RTP.
 *
 *   Outcome space: 16 equal-probability results (1/16 each)
 *     0     = cue ball / zero
 *     1–15  = numbered balls
 *
 *   Expected total-return multipliers:
 *     Single 0 or 1–15  :  16/1  × 0.95 = 15.2       hit = 1/16  =  6.25 %
 *     Low  (1–8)        :  16/8  × 0.95 = 1.9         hit = 8/16  = 50.00 %
 *     High (8–15)       :  16/8  × 0.95 = 1.9         hit = 8/16  = 50.00 %
 *     Odd  (8 covered)  :  16/8  × 0.95 = 1.9         hit = 8/16  = 50.00 %
 *     Even (7 covered)  :  16/7  × 0.95 ≈ 2.1714      hit = 7/16  = 43.75 %
 */

import { BET_DEFS, BetKey, TOTAL_OUTCOMES } from '../config/paytable';
import { ReplaySelectionPolicy } from '../controllers/ReplaySelectionPolicy';

const ROUNDS_PER_BET = 1_000_000;
const BET            = 100;  // use realistic bet size; floor() precision loss is negligible
const TOLERANCE      = 0.010; // ±1.0 %

const BET_KEYS_TO_TEST: BetKey[] = [
  'ball-0',   // single cue ball (zero)
  'ball-1',   // single numbered ball
  'low',
  'high',
  'odd',
  'even',
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
  const def    = BET_DEFS.get(key)!;
  const policy = new ReplaySelectionPolicy();

  let totalBet    = 0;
  let totalReturn = 0;
  let wins        = 0;

  for (let i = 0; i < ROUNDS_PER_BET; i++) {
    const winner = policy.drawWinner(key);
    const { won, payout } = policy.resolveOutcome(winner, key, BET);
    totalBet    += BET;
    totalReturn += won ? payout : 0;
    if (won) wins++;
  }

  const simulatedRTP = totalReturn / totalBet;
  return {
    key,
    label:        def.label + (def.sublabel ? ` (${def.sublabel})` : ''),
    covered:      def.balls.length,
    expectedRTP:  def.payoutMultiplier * (def.balls.length / TOTAL_OUTCOMES),
    simulatedRTP,
    hitRate:      wins / ROUNDS_PER_BET,
    pass:         Math.abs(simulatedRTP - 0.95) <= TOLERANCE,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('──────────────────────────────────────────────────────────');
console.log('  Pool Break Bet — RTP Simulation  (16-outcome model)');
console.log('──────────────────────────────────────────────────────────');
console.log(`  Rounds per bet type : ${ROUNDS_PER_BET.toLocaleString()}`);
console.log('──────────────────────────────────────────────────────────');

const results: SimResult[] = BET_KEYS_TO_TEST.map(simulate);

let allPass = true;
for (const r of results) {
  const rtpStr = (r.simulatedRTP * 100).toFixed(3);
  const hitStr = (r.hitRate      * 100).toFixed(3);
  const expStr = (r.expectedRTP  * 100).toFixed(3);
  const status = r.pass ? '✓' : '✗';
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

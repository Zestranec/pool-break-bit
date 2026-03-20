/**
 * RTP Simulation — run with:  npm run sim
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Probability maths (documented here and in paytable.ts):
 *
 *   8 equal-probability balls → P(win per ball) = 1/8 = 0.125
 *   Target RTP = 95 %
 *   Payout multiplier = RTP / P(win) = 0.95 / 0.125 = 7.60
 *
 *   Expected return per round (1 unit bet):
 *     E[return] = P(win) × payout_multiplier + P(lose) × 0
 *               = 0.125 × 7.60
 *               = 0.95                        ← 95 % RTP
 *
 *   House edge = 1 − RTP = 0.05 = 5 %
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { ProbabilityController } from '../controllers/ProbabilityController';
import { OutcomeController }      from '../controllers/OutcomeController';

const ROUNDS       = 1_000_000;
const BALL_COUNT   = 8;
const BET          = 1;          // normalise to 1 unit

let totalBet    = 0;
let totalReturn = 0;
let wins        = 0;

const rng = ProbabilityController.fresh();

// Rotate through all 8 ball selections to simulate a uniform player pool
for (let i = 0; i < ROUNDS; i++) {
  const selectedBallId = (i % BALL_COUNT) + 1;

  const outcome = OutcomeController.resolve(selectedBallId, rng);

  totalBet    += BET;
  totalReturn += outcome.isWin ? BET * outcome.payoutMultiplier : 0;
  if (outcome.isWin) wins++;
}

const simulatedRTP     = totalReturn / totalBet;
const simulatedHitRate = wins / ROUNDS;

console.log('──────────────────────────────────────────────');
console.log('  Pool Break Bet — RTP Simulation');
console.log('──────────────────────────────────────────────');
console.log(`  Rounds simulated : ${ROUNDS.toLocaleString()}`);
console.log(`  Wins             : ${wins.toLocaleString()}`);
console.log(`  Hit rate         : ${(simulatedHitRate * 100).toFixed(4)} %`);
console.log(`    (expected 12.5000 %)`);
console.log(`  Simulated RTP    : ${(simulatedRTP * 100).toFixed(4)} %`);
console.log(`    (target  95.0000 %)`);
console.log('──────────────────────────────────────────────');

if (Math.abs(simulatedRTP - 0.95) > 0.005) {
  console.error('❌  RTP out of tolerance — check paytable!');
  process.exit(1);
} else {
  console.log('✅  RTP within tolerance.');
}

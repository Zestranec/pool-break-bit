/**
 * ReplaySelectionPolicy
 *
 * Implements the economic guarantee (RTP) independently of the physics
 * simulation.  The policy:
 *
 *  1. Receives the player's bet (which ball IDs they have covered).
 *  2. Picks a "target outcome" ball ID according to a weighted distribution
 *     that ensures long-run RTP ≈ 95 %.
 *  3. Returns the target ball ID so the caller can select a matching replay.
 *
 * ── RTP maths ────────────────────────────────────────────────────────────────
 *  There are 16 outcomes (0 = cue ball, 1–15 = numbered balls).
 *  Each outcome is equally likely:
 *    P(outcome = k) = 1/16  for k ∈ {0…15}.
 *
 *  If the player bets on N balls, the payout multiplier on a win is:
 *    multiplier = (16 / N) × 0.95
 *  which gives an EV per unit bet of:
 *    EV = (N/16) × (16/N × 0.95) = 0.95   (RTP = 95 % regardless of N) ✓
 *
 *  Outcome 0 is the cue-ball / zero.  It is NOT included in any outside bet:
 *    LOW  = {1,2,3,4,5,6,7,8}    (8 balls)
 *    HIGH = {8,9,10,11,12,13,14,15} (8 balls)
 *    ODD  = {1,3,5,7,9,11,13,15}   (8 balls)
 *    EVEN = {2,4,6,8,10,12,14}     (7 balls — 0 excluded)
 *
 * ── Implementation ────────────────────────────────────────────────────────────
 *  Each round, we draw a uniform random integer 0–15.  That is the winner.
 *  We do NOT manipulate the physics — we manipulate the SELECTION of which
 *  pre-recorded replay to show, so the correct ball is always first pocketed.
 */

import { getBetDef, TOTAL_OUTCOMES } from '../config/paytable';

export class ReplaySelectionPolicy {
  /**
   * Draw a winning ball ID (0–15) using a uniform distribution.
   *   0 = cue ball (zero outcome)
   *   1–15 = numbered ball
   * @param _betKey ignored — kept for interface symmetry; all bets give same EV.
   */
  drawWinner(_betKey: string | null): number {
    return Math.floor(Math.random() * TOTAL_OUTCOMES); // 0…15 uniform
  }

  /**
   * Given the winning ball ID and the player's bet, compute:
   *   - whether the player won
   *   - the payout (0 on loss, floor(bet × (16/N) × 0.95) on win)
   */
  resolveOutcome(
    winnerBallId: number,
    betKey: string | null,
    betAmount: number,
  ): { won: boolean; payout: number } {
    if (!betKey) return { won: false, payout: 0 };

    const def = getBetDef(betKey);
    if (!def) return { won: false, payout: 0 };

    const won = def.balls.includes(winnerBallId);
    if (!won) return { won: false, payout: 0 };

    const multiplier = (TOTAL_OUTCOMES / def.balls.length) * 0.95;
    return { won: true, payout: Math.floor(betAmount * multiplier) };
  }
}

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
 *  There are 15 outcomes (balls 1–15).  Each outcome is equally likely:
 *    P(outcome = k) = 1/15  for k ∈ {1…15}.
 *
 *  If the player bets on N balls, the payout multiplier on a win is:
 *    multiplier = (15 / N) × 0.95
 *  which gives an EV per unit bet of:
 *    EV = (N/15) × (15/N × 0.95) = 0.95   (RTP = 95 % regardless of N) ✓
 *
 *  The "outside bets" map to ball subsets:
 *    LOW  = {1,2,3,4,5,6,7}     (7 balls)
 *    HIGH = {9,10,11,12,13,14,15} (7 balls)
 *    ODD  = {1,3,5,7,9,11,13,15}  (8 balls)
 *    EVEN = {2,4,6,8,10,12,14}    (7 balls)
 *
 * ── Implementation ────────────────────────────────────────────────────────────
 *  Each round, we draw a uniform random integer 1–15.  That is the winner.
 *  We do NOT manipulate the physics — we manipulate the SELECTION of which
 *  pre-recorded replay to show, so the correct ball is always first pocketed.
 */

import { getBetDef } from '../config/paytable';

export class ReplaySelectionPolicy {
  /**
   * Draw a winning ball ID (1–15) using a uniform distribution.
   * @param _betKey ignored — kept for interface symmetry; all bets give same EV.
   */
  drawWinner(_betKey: string | null): number {
    return Math.floor(Math.random() * 15) + 1; // 1…15 uniform
  }

  /**
   * Given the winning ball ID and the player's bet, compute:
   *   - whether the player won
   *   - the payout multiplier (0 on loss, (15/N)×0.95 on win)
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

    const multiplier = (15 / def.balls.length) * 0.95;
    return { won: true, payout: Math.floor(betAmount * multiplier) };
  }
}

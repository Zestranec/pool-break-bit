import { RoundOutcome } from '../state/GameState';
import { ProbabilityController } from './ProbabilityController';
import { PAYTABLE } from '../config/paytable';
import { SCATTER_PRESETS } from '../config/scatterPresets';
import { ANIM, POCKETS, BALL_COUNT } from '../config/gameConfig';

export class OutcomeController {
  /**
   * Pre-compute the full round outcome BEFORE any animation runs.
   * This is the contract: winner is decided here, animation only visualises it.
   */
  static resolve(
    selectedBallId: number,      // 1-indexed, chosen by player
    rng: ProbabilityController,
  ): RoundOutcome {
    const seed = rng.getSeed();

    // ── 1. Pick winning ball (equal probability across 8 balls) ──
    const winningBallId = rng.nextInt(BALL_COUNT) + 1; // 1-8

    const isWin = winningBallId === selectedBallId;
    const payEntry = PAYTABLE.find(e => e.ballId === winningBallId)!;

    // ── 2. Pick scatter preset ──
    const preset = rng.pick(SCATTER_PRESETS);

    // ── 3. Pick winning pocket (any of the 6) ──
    const winningPocketId = rng.nextInt(POCKETS.length);

    // ── 4. Pick first-pocket timing ──
    const firstPocketTimeSec = rng.nextRange(
      ANIM.firstPocketMin,
      ANIM.firstPocketMax,
    );

    // ── 5. Near-miss: applied when the player loses ──
    let nearMissBallId: number | undefined;
    let nearMissPocketId: number | undefined;
    if (!isWin && rng.next() < 0.55) {
      // 55 % of losses show a near-miss on the player's ball
      nearMissBallId  = selectedBallId;
      nearMissPocketId = rng.nextInt(POCKETS.length);
    }

    // ── 6. Optional secondary balls that pocket after the winner ──
    const secondaryCount = rng.nextInt(3); // 0-2 extra balls
    const secondaryPocketedBallIds: number[] = [];
    const used = new Set([winningBallId, ...(nearMissBallId ? [nearMissBallId] : [])]);
    for (let i = 0; i < secondaryCount; i++) {
      let candidate = rng.nextInt(BALL_COUNT) + 1;
      if (!used.has(candidate)) {
        secondaryPocketedBallIds.push(candidate);
        used.add(candidate);
      }
    }

    return {
      seed,
      selectedBallId,
      winningBallId,
      isWin,
      payoutMultiplier: payEntry.payoutMultiplier,
      cueBallStartPresetId: preset.cueBallPresetId,
      winningPocketId,
      firstPocketTimeSec,
      scatterPresetId: preset.id,
      nearMissBallId,
      nearMissPocketId,
      secondaryPocketedBallIds,
    };
  }
}

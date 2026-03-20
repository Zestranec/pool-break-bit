import { RoundOutcome } from '../state/GameState';
import { ProbabilityController } from './ProbabilityController';
import { getBetDef, TOTAL_OUTCOMES, BetKey } from '../config/paytable';
import { SCATTER_PRESETS } from '../config/scatterPresets';
import { ANIM, POCKETS, FELT, BALL_RADIUS, POCKET_RADIUS } from '../config/gameConfig';

// ─── Cue ball spawn ──────────────────────────────────────────────────────────
// Spawn zone: bottom third of the felt (farthest from the rack which sits
// in the upper half).  Up to 30 attempts are made to find a position that
// clears every pocket by at least (POCKET_RADIUS + BALL_RADIUS + 5) px.
// Fallback to the felt centre-bottom if all attempts are blocked.
const SPAWN_CLEARANCE = POCKET_RADIUS + BALL_RADIUS + 5;

function pickCueBallSpawn(rng: ProbabilityController): { x: number; y: number } {
  const feltH  = FELT.bottom - FELT.top;
  const zoneY0 = FELT.bottom - feltH / 3;
  const minX   = FELT.left  + BALL_RADIUS + 2;
  const maxX   = FELT.right - BALL_RADIUS - 2;
  const minY   = zoneY0;
  const maxY   = FELT.bottom - BALL_RADIUS - 2;

  for (let attempt = 0; attempt < 30; attempt++) {
    const x = minX + rng.next() * (maxX - minX);
    const y = minY + rng.next() * (maxY - minY);
    const clear = POCKETS.every(p => {
      const dx = x - p.x;
      const dy = y - p.y;
      return Math.sqrt(dx * dx + dy * dy) >= SPAWN_CLEARANCE;
    });
    if (clear) return { x, y };
  }
  return { x: (FELT.left + FELT.right) / 2, y: maxY - 10 };
}

export class OutcomeController {
  /**
   * Pre-compute the full round outcome BEFORE any animation runs.
   * Draws a uniform integer 1–17:
   *   1–15  → that numbered ball pockets first (winningBallId = n)
   *   16    → cue ball scratch (winningBallId = null)
   *   17    → house wins, no guided ball (winningBallId = null)
   */
  static resolve(
    selectedBetKey: string,
    rng: ProbabilityController,
  ): RoundOutcome {
    const seed    = rng.getSeed();
    const betDef  = getBetDef(selectedBetKey as BetKey);

    // ── 1. Draw outcome (1–17 uniform) ──────────────────────────────────────
    const outcomeResult  = rng.nextInt(TOTAL_OUTCOMES) + 1;  // 1–17
    const winningBallId  = outcomeResult <= 15 ? outcomeResult : null;
    const isWin          = betDef.coveredResults.includes(outcomeResult);

    // ── 2. Pick scatter preset ───────────────────────────────────────────────
    const preset = rng.pick(SCATTER_PRESETS);

    // ── 3. Pick winning pocket (only meaningful when a ball wins) ────────────
    const winningPocketId = rng.nextInt(POCKETS.length);

    // ── 4. Pick first-pocket timing ──────────────────────────────────────────
    const firstPocketTimeSec = rng.nextRange(
      ANIM.firstPocketMin,
      ANIM.firstPocketMax,
    );

    // ── 5. Near-miss: only for single-ball bets on a loss ───────────────────
    let nearMissBallId: number | undefined;
    let nearMissPocketId: number | undefined;
    if (
      !isWin &&
      selectedBetKey.startsWith('ball-') &&
      winningBallId !== null &&
      rng.next() < 0.55
    ) {
      // Show the player's chosen ball rolling near a pocket before deflecting
      const chosenBallId = Number(selectedBetKey.replace('ball-', ''));
      if (chosenBallId !== winningBallId) {
        nearMissBallId   = chosenBallId;
        nearMissPocketId = rng.nextInt(POCKETS.length);
      }
    }

    // ── 6. Optional secondary balls that pocket after the winner ─────────────
    const secondaryCount = rng.nextInt(3); // 0–2 extra balls
    const secondaryPocketedBallIds: number[] = [];
    if (winningBallId !== null) {
      const used = new Set([winningBallId, ...(nearMissBallId ? [nearMissBallId] : [])]);
      for (let i = 0; i < secondaryCount; i++) {
        const candidate = rng.nextInt(15) + 1; // 1–15
        if (!used.has(candidate)) {
          secondaryPocketedBallIds.push(candidate);
          used.add(candidate);
        }
      }
    }

    const spawn = pickCueBallSpawn(rng);

    return {
      seed,
      selectedBetKey,
      outcomeResult,
      winningBallId,
      isWin,
      payoutMultiplier: betDef.payoutMultiplier,
      cueBallSpawnX:    spawn.x,
      cueBallSpawnY:    spawn.y,
      winningPocketId,
      firstPocketTimeSec,
      scatterPresetId:  preset.id,
      nearMissBallId,
      nearMissPocketId,
      secondaryPocketedBallIds,
    };
  }
}

/**
 * ReplayPlayer
 *
 * Plays back a recorded round by interpolating between position samples
 * and driving the PixiJS sprite positions via the app ticker.
 *
 * Timeline:
 *   0 ms  … pre-impact  — cue ball show / pullback / strike (GSAP, same as before)
 *   60 ms … impact      — table shake + rack flash
 *   ~60 ms …            — ball scatter playback begins from sample[0]
 *   firstPocket         — winner ball pocket() called; table flashPocket()
 *   +850 ms             — resolve callback fired
 */

import { type RoundData, SAMPLE_STRIDE } from './ReplayTypes';
import { type BallSprite } from '../objects/BallSprite';
import { type CueBall }    from '../objects/CueBall';
import { type PoolTable }  from '../objects/PoolTable';
import { RACK_POSITIONS, BALL_RADIUS } from '../config/gameConfig';

type TickerFn = (dt: { deltaMS: number }) => void;

// Playback speed multiplier (1 = real time).
const PLAYBACK_RATE = 1.0;

export class ReplayPlayer {
  constructor(
    private tickerAdd:    (fn: TickerFn) => void,
    private tickerRemove: (fn: TickerFn) => void,
  ) {}

  /**
   * Play back a round.
   *
   * @param round       – the loaded RoundData
   * @param balls       – 15 BallSprite instances, same order as rack slots
   * @param cueBall     – the cue ball sprite
   * @param table       – the pool table (for flashPocket / shake / impact)
   * @param onResolve   – called after the winning ball is pocketed + settle delay
   */
  async play(
    round:     RoundData,
    balls:     BallSprite[],
    cueBall:   CueBall,
    table:     PoolTable,
  ): Promise<void> {
    // ── Cue stick pre-impact animation (identical to AnimationController) ────
    const rackImpactX = RACK_POSITIONS[0].x;
    const rackImpactY = RACK_POSITIONS[0].y + BALL_RADIUS + 2;
    const cueX = round.cueX;
    const cueY = round.cueY;

    cueBall.rotation = Math.atan2(rackImpactX - cueX, cueY - rackImpactY);
    await cueBall.showAt(cueX, cueY);
    await cueBall.animateStrike();
    await cueBall.travelTo(rackImpactX, rackImpactY, 0.22);

    cueBall.impact();
    table.addTableShake();
    table.rackImpactFlash(rackImpactX, rackImpactY);
    await sleep(60);
    cueBall.disappear();

    // ── Build lookup: pocketId per ballId (from pocket events) ───────────────
    const pocketIdFor = new Map<number, number>(); // ballId → pocketId
    const pocketTimeFor = new Map<number, number>(); // ballId → tMs
    for (const pe of round.pe) {
      if (!pocketIdFor.has(pe.b)) {
        pocketIdFor.set(pe.b, pe.p);
        pocketTimeFor.set(pe.b, pe.t);
      }
    }

    // ── Map rack slot → BallSprite ────────────────────────────────────────────
    // balls[i] is at rack slot i; round.bc[i] is the ball ID in that slot.
    // Build a map from ball ID → sprite for pocket event lookup.
    const spriteForId = new Map<number, BallSprite>();
    for (let slot = 0; slot < 15; slot++) {
      const ballId = round.bc[slot];
      spriteForId.set(ballId, balls[slot]);
    }

    // Track which balls have already been pocketed via replay.
    const pocketed = new Set<number>(); // ballId

    // ── Playback ticker ───────────────────────────────────────────────────────
    const samples = round.s;
    const nSamples = samples.length;

    return new Promise<void>((resolve) => {
      let replayMs   = 0;          // virtual time into the replay
      let winnerPocketedAt: number | null = null;

      const update: TickerFn = ({ deltaMS }) => {
        replayMs += deltaMS * PLAYBACK_RATE;

        // Find the two bracketing samples.
        // Binary search is overkill for ≤300 samples — linear scan is fine.
        let loIdx = 0;
        for (let i = 0; i < nSamples - 1; i++) {
          if (samples[i + 1][0] <= replayMs) {
            loIdx = i + 1;
          } else {
            break;
          }
        }
        const hiIdx = Math.min(loIdx + 1, nSamples - 1);

        const loSample = samples[loIdx];
        const hiSample = samples[hiIdx];
        const lo_t = loSample[0];
        const hi_t = hiSample[0];
        const t = hi_t > lo_t
          ? Math.min((replayMs - lo_t) / (hi_t - lo_t), 1)
          : 1;

        // ── Update cue ball position (indices 1,2) ────────────────────────
        // The cue ball has already disappeared after impact, so skip it.

        // ── Update object ball positions (slots 0–14) ─────────────────────
        for (let slot = 0; slot < 15; slot++) {
          const ballId = round.bc[slot];
          if (pocketed.has(ballId)) continue;

          const idx = 3 + slot * 2;
          const loX = loSample[idx];     const loY = loSample[idx + 1];
          const hiX = hiSample[idx];     const hiY = hiSample[idx + 1];

          // 0,0 sentinel means pocketed in the Go sim.
          const isPocketed = (hiX === 0 && hiY === 0 && loX === 0 && loY === 0)
            || (hiX === 0 && hiY === 0 && replayMs >= hi_t);

          if (isPocketed && !pocketed.has(ballId)) {
            pocketed.add(ballId);
            const pid = pocketIdFor.get(ballId);
            balls[slot].pocket(() => {
              if (pid !== undefined) table.flashPocket(pid);
            });
            if (ballId === round.firstBall) {
              winnerPocketedAt = replayMs;
            }
            continue;
          }

          if (!isPocketed) {
            balls[slot].x = lerp(loX, hiX, t);
            balls[slot].y = lerp(loY, hiY, t);
          }
        }

        // ── Settle after winner pockets ───────────────────────────────────
        if (winnerPocketedAt !== null && replayMs - winnerPocketedAt >= 850) {
          this.tickerRemove(update);
          resolve();
          return;
        }

        // Safety timeout: if the replay data ends and no winner was pocketed,
        // resolve anyway (shouldn't happen with quality-filtered dataset).
        if (replayMs >= (samples[nSamples - 1][0] ?? 10000) + 1000) {
          this.tickerRemove(update);
          resolve();
        }
      };

      this.tickerAdd(update);
    });
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

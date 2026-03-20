/**
 * AnimationController
 *
 * Motion model: per-frame physics integration running on the PixiJS ticker.
 * Every frame: position += velocity * dt,  velocity *= retainFraction^dt
 *
 * This eliminates all stop-start artefacts that came from chaining GSAP tweens
 * with `await` — which introduced JS event-loop gaps between every segment and
 * caused `power3.out` to brake each segment to zero before the next one began.
 *
 * The winner ball is guided by soft velocity steering: each frame its velocity
 * is lerped toward the direction / magnitude needed to arrive at the pocket on
 * time.  No waypoints, no snapping, no phase boundaries.
 */

import { gsap } from 'gsap';
import { BallSprite }    from '../objects/BallSprite';
import { CueBall }       from '../objects/CueBall';
import { PoolTable }     from '../objects/PoolTable';
import { RoundOutcome }  from '../state/GameState';
import {
  RACK_POSITIONS, CUE_BALL_PRESETS, POCKETS, FELT, BALL_RADIUS,
} from '../config/gameConfig';
import { SCATTER_PRESETS } from '../config/scatterPresets';

// ─── Per-ball physics state ──────────────────────────────────────────────────
interface BallState {
  ball:     BallSprite;
  vx:       number;     // px / s
  vy:       number;     // px / s
  /** Fraction of velocity that survives after 1 full second (0 < retain < 1). */
  retain:   number;
  role:     'normal' | 'winner' | 'nearMiss' | 'secondary';
  active:   boolean;
  pocketed: boolean;

  // winner
  pocketX?:      number;
  pocketY?:      number;
  guidanceStart?: number;  // elapsed (s) when steering begins
  pocketTime?:   number;   // elapsed (s) when pocket must fire
  pocketId?:     number;

  // near-miss
  nmPocketX?:   number;
  nmPocketY?:   number;
  nmDeflectAt?: number;    // elapsed (s) to apply deflection
  nmDeflected?: boolean;

  // secondary
  secPocketX?:  number;
  secPocketY?:  number;
  secPocketAt?: number;
}

type TickerFn = (dt: { deltaMS: number }) => void;

export class AnimationController {
  private activeUpdate: TickerFn | null = null;

  constructor(
    private balls:        BallSprite[],
    private cueBall:      CueBall,
    private table:        PoolTable,
    private tickerAdd:    (fn: TickerFn) => void,
    private tickerRemove: (fn: TickerFn) => void,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async play(outcome: RoundOutcome): Promise<void> {
    const presetData = SCATTER_PRESETS.find(p => p.id === outcome.scatterPresetId)
      ?? SCATTER_PRESETS[0];

    const cuePre    = CUE_BALL_PRESETS[outcome.cueBallStartPresetId];
    const winPocket = POCKETS[outcome.winningPocketId];

    // ── Cue ball: show, pullback, strike, travel ─────────────────────────────
    // These three steps are short GSAP sequences on a single sprite (no chaining
    // problem — they run sequentially and don't cause ball motion jitter).
    await this.cueBall.showAt(cuePre.x, cuePre.y);
    await this.cueBall.animateStrike();
    const rackImpactX = RACK_POSITIONS[4].x;
    const rackImpactY = RACK_POSITIONS[6].y + BALL_RADIUS + 2;
    await this.cueBall.travelTo(rackImpactX, rackImpactY, 0.22);

    this.cueBall.impact();
    this.table.addTableShake();
    await sleep(60);
    this.cueBall.disappear();

    // ── Build physics state for all 8 balls ──────────────────────────────────
    const firstPocketSec  = outcome.firstPocketTimeSec;
    // Guidance starts at 35 % of the pocket window so the ball has time to
    // steer smoothly — not a last-second lunge.
    const guidanceStart   = firstPocketSec * 0.35;

    const states: BallState[] = this.balls.map((ball, i) => {
      const ballId     = i + 1;
      const vel        = presetData.velocities[i];
      const isWinner   = ballId === outcome.winningBallId;
      const isNearMiss = ballId === outcome.nearMissBallId;
      const isSecondary = outcome.secondaryPocketedBallIds?.includes(ballId) ?? false;

      // Vary initial speed slightly so balls don't all travel the same distance
      const speed = vel.speed * (0.82 + Math.random() * 0.36);

      const st: BallState = {
        ball,
        vx:      vel.vx * speed,
        vy:      vel.vy * speed,
        // Winner retains speed longer (0.35 → 35 % left after 1 s);
        // normal balls brake faster (0.08 → 8 % left after 1 s).
        retain:  isWinner ? 0.35 : 0.08,
        role:    isWinner ? 'winner'
               : isNearMiss ? 'nearMiss'
               : isSecondary ? 'secondary'
               : 'normal',
        active:  true,
        pocketed: false,
      };

      if (isWinner) {
        st.pocketX      = winPocket.x;
        st.pocketY      = winPocket.y;
        st.guidanceStart = guidanceStart;
        st.pocketTime   = firstPocketSec;
        st.pocketId     = outcome.winningPocketId;
      }

      if (isNearMiss && outcome.nearMissPocketId !== undefined) {
        const nmP       = POCKETS[outcome.nearMissPocketId];
        st.nmPocketX    = nmP.x;
        st.nmPocketY    = nmP.y;
        // Deflect well before winner pockets so the player sees the near-miss
        st.nmDeflectAt  = firstPocketSec * 0.62;
        st.nmDeflected  = false;
      }

      if (isSecondary) {
        const secP       = POCKETS[(outcome.winningPocketId + 2) % 6];
        st.secPocketX   = secP.x;
        st.secPocketY   = secP.y;
        st.secPocketAt  = firstPocketSec + 0.65;
      }

      return st;
    });

    // ── Physics loop ─────────────────────────────────────────────────────────
    return new Promise<void>((resolve) => {
      let elapsed          = 0;
      let winnerPocketedAt: number | null = null;

      const update: TickerFn = ({ deltaMS }) => {
        // Cap dt to avoid enormous jumps if tab is backgrounded
        const dt = Math.min(deltaMS / 1000, 0.05);
        elapsed += dt;

        for (const bs of states) {
          if (!bs.active || bs.pocketed) continue;

          // ── Winner: soft-steering toward pocket ──────────────────────────
          if (bs.role === 'winner') {
            const tx   = bs.pocketX! - bs.ball.x;
            const ty   = bs.pocketY! - bs.ball.y;
            const dist = Math.sqrt(tx * tx + ty * ty) + 0.001;

            // Pocket capture: within 1.8 ball radii OR time overrun
            if (
              (elapsed >= bs.guidanceStart! - 0.05 && dist < BALL_RADIUS * 1.8) ||
              elapsed >= bs.pocketTime! + 0.2
            ) {
              bs.pocketed = true;
              bs.active   = false;
              winnerPocketedAt = elapsed;
              const pid = bs.pocketId;
              bs.ball.pocket(() => {
                if (pid !== undefined) this.table.flashPocket(pid);
              });
              continue;
            }

            // Steering: lerp velocity toward the direction and magnitude
            // needed to arrive exactly at pocket on time.
            if (elapsed >= bs.guidanceStart!) {
              const timeLeft    = Math.max(bs.pocketTime! - elapsed, 0.04);
              // neededSpeed = how fast we must go to cover remaining distance
              const neededSpeed = Math.min(dist / timeLeft, 700);
              const desiredVx   = (tx / dist) * neededSpeed;
              const desiredVy   = (ty / dist) * neededSpeed;
              // Blend rate: converges in ~0.25 s so the turn feels organic
              const blend = Math.min(1.0, dt * 5.5);
              bs.vx += (desiredVx - bs.vx) * blend;
              bs.vy += (desiredVy - bs.vy) * blend;
            }
          }

          // ── Near-miss: physics approach then perpendicular deflect ────────
          if (bs.role === 'nearMiss' && !bs.nmDeflected && elapsed >= bs.nmDeflectAt!) {
            const tx   = bs.nmPocketX! - bs.ball.x;
            const ty   = bs.nmPocketY! - bs.ball.y;
            const dist = Math.sqrt(tx * tx + ty * ty) + 0.001;
            // Remove the velocity component pointing toward the pocket, then
            // add a perpendicular kick so the ball skims past instead of sinking.
            const dot = (bs.vx * tx + bs.vy * ty) / (dist * dist);
            bs.vx -= 2.1 * dot * tx;
            bs.vy -= 2.1 * dot * ty;
            bs.nmDeflected = true;
          }

          // ── Secondary: guided into its pocket after a delay ───────────────
          if (bs.role === 'secondary' && bs.secPocketAt !== undefined) {
            const tx   = bs.secPocketX! - bs.ball.x;
            const ty   = bs.secPocketY! - bs.ball.y;
            const dist = Math.sqrt(tx * tx + ty * ty) + 0.001;

            if (dist < BALL_RADIUS * 1.8 || elapsed >= bs.secPocketAt + 0.2) {
              bs.pocketed = true;
              bs.active   = false;
              bs.ball.pocket();
              continue;
            }
            // Gentle guidance starting 0.9 s before scheduled pocket time
            if (elapsed >= bs.secPocketAt - 0.9) {
              const timeLeft    = Math.max(bs.secPocketAt - elapsed, 0.04);
              const neededSpeed = Math.min(dist / timeLeft, 500);
              const desiredVx   = (tx / dist) * neededSpeed;
              const desiredVy   = (ty / dist) * neededSpeed;
              const blend = Math.min(1.0, dt * 3.5);
              bs.vx += (desiredVx - bs.vx) * blend;
              bs.vy += (desiredVy - bs.vy) * blend;
            }
          }

          // ── Integrate position ────────────────────────────────────────────
          bs.ball.x += bs.vx * dt;
          bs.ball.y += bs.vy * dt;

          // ── Cushion bounce ────────────────────────────────────────────────
          // Balls reflect off the felt boundary with ~72 % energy retained.
          const R = BALL_RADIUS;
          if (bs.ball.x < FELT.left + R) {
            bs.ball.x = FELT.left + R;
            bs.vx = Math.abs(bs.vx) * 0.72;
          } else if (bs.ball.x > FELT.right - R) {
            bs.ball.x = FELT.right - R;
            bs.vx = -Math.abs(bs.vx) * 0.72;
          }
          if (bs.ball.y < FELT.top + R) {
            bs.ball.y = FELT.top + R;
            bs.vy = Math.abs(bs.vy) * 0.72;
          } else if (bs.ball.y > FELT.bottom - R) {
            bs.ball.y = FELT.bottom - R;
            bs.vy = -Math.abs(bs.vy) * 0.72;
          }

          // ── Friction / damping ────────────────────────────────────────────
          // Exponential decay: v(t) = v0 × retain^t
          const d = Math.pow(bs.retain, dt);
          bs.vx  *= d;
          bs.vy  *= d;
        }

        // ── Resolve: 0.8 s after winner pockets, settle everything ───────────
        if (winnerPocketedAt !== null && elapsed - winnerPocketedAt >= 0.80) {
          this.cleanup(states, update, resolve);
          return;
        }
        // Safety timeout in case something goes wrong
        if (elapsed >= 6.0) {
          this.cleanup(states, update, resolve);
        }
      };

      this.activeUpdate = update;
      this.tickerAdd(update);
    });
  }

  private cleanup(states: BallState[], update: TickerFn, resolve: () => void): void {
    for (const bs of states) bs.active = false;
    this.tickerRemove(update);
    this.activeUpdate = null;
    resolve();
  }

  killAll(): void {
    if (this.activeUpdate) {
      this.tickerRemove(this.activeUpdate);
      this.activeUpdate = null;
    }
    gsap.killTweensOf(this.cueBall);
    gsap.killTweensOf(this.cueBall.stick);
    gsap.killTweensOf(this.cueBall.scale);
    for (const ball of this.balls) {
      gsap.killTweensOf(ball);
      gsap.killTweensOf(ball.scale);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

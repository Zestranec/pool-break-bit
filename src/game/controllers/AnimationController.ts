/**
 * AnimationController
 *
 * Physics model: per-frame simulation with ball-ball elastic collisions,
 * rolling friction, and cushion bounces.  Outcome remains deterministic —
 * the winner ball is guided smoothly toward its predetermined pocket while
 * all other balls follow pure physics.
 *
 * Each frame runs three passes:
 *   1. Steering  — apply winner guidance / near-miss deflect / secondary aim
 *   2. Integrate — position += velocity * dt
 *   3. Collide   — ball-ball elastic response, rail bounce, friction, pockets
 */

import { gsap } from 'gsap';
import { BallSprite }   from '../objects/BallSprite';
import { CueBall }      from '../objects/CueBall';
import { PoolTable }    from '../objects/PoolTable';
import { RoundOutcome } from '../state/GameState';
import {
  RACK_POSITIONS, POCKETS, FELT, BALL_RADIUS, POCKET_RADIUS,
} from '../config/gameConfig';
import { SCATTER_PRESETS } from '../config/scatterPresets';

// ── Physics constants ─────────────────────────────────────────────────────────
/** Fraction of speed surviving 1 s of rolling on felt (all normal balls).
 *  0.38 gives ~300 px total travel from 290 px/s — enough to cross the
 *  taller portrait table before stopping. */
const ROLLING_RETAIN   = 0.38;
/** Winner retains more speed so guidance can steer it reliably to its pocket. */
const WINNER_RETAIN    = 0.55;
/** Energy fraction kept after a cushion bounce (~65 % is realistic for felt rails). */
const RAIL_RETENTION   = 0.65;
/** Coefficient of restitution for ball-ball collisions (pool balls ≈ 0.85–0.92). */
const BALL_RESTITUTION = 0.87;
/** Balls below this speed (px/s) are fully stopped — prevents eternal slow drift. */
const STOP_SPEED       = 5;

// ─── Per-ball physics state ───────────────────────────────────────────────────
interface BallState {
  ball:     BallSprite;
  vx:       number;
  vy:       number;
  retain:   number;
  role:     'normal' | 'winner' | 'nearMiss' | 'secondary';
  active:   boolean;
  pocketed: boolean;

  // winner
  pocketX?:       number;
  pocketY?:       number;
  guidanceStart?: number;
  pocketTime?:    number;
  pocketId?:      number;

  // near-miss
  nmPocketX?:   number;
  nmPocketY?:   number;
  nmDeflectAt?: number;
  nmDeflected?: boolean;

  // secondary
  secPocketX?:  number;
  secPocketY?:  number;
  secPocketAt?: number;
}

type TickerFn = (dt: { deltaMS: number }) => void;

// ── Ball-ball elastic collision resolution ────────────────────────────────────
// Runs an O(n²) sweep over all non-pocketed pairs each frame.
// With 15 balls that is at most 105 pair checks — negligible cost.
function resolveCollisions(states: BallState[]): void {
  const minDist   = BALL_RADIUS * 2;
  const minDistSq = minDist * minDist;

  for (let ai = 0; ai < states.length - 1; ai++) {
    const sa = states[ai];
    if (sa.pocketed) continue;

    for (let bi = ai + 1; bi < states.length; bi++) {
      const sb = states[bi];
      if (sb.pocketed) continue;

      const dx = sb.ball.x - sa.ball.x;
      const dy = sb.ball.y - sa.ball.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDistSq || distSq < 0.0001) continue;

      const dist = Math.sqrt(distSq);
      const nx   = dx / dist;
      const ny   = dy / dist;

      // Depenetrate — push the two balls apart equally along the normal.
      const push = (minDist - dist) * 0.5;
      sa.ball.x -= nx * push;
      sa.ball.y -= ny * push;
      sb.ball.x += nx * push;
      sb.ball.y += ny * push;

      // Relative velocity of a toward b along the collision normal.
      const rvn = (sa.vx - sb.vx) * nx + (sa.vy - sb.vy) * ny;
      if (rvn <= 0) continue; // already separating

      // Equal-mass elastic impulse with restitution coefficient.
      const j = (1 + BALL_RESTITUTION) * rvn / 2;
      sa.vx -= j * nx;
      sa.vy -= j * ny;
      sb.vx += j * nx;
      sb.vy += j * ny;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export class AnimationController {
  private activeUpdate: TickerFn | null = null;

  constructor(
    private balls:        BallSprite[],
    private cueBall:      CueBall,
    private table:        PoolTable,
    private tickerAdd:    (fn: TickerFn) => void,
    private tickerRemove: (fn: TickerFn) => void,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async play(outcome: RoundOutcome): Promise<void> {
    const presetData = SCATTER_PRESETS.find(p => p.id === outcome.scatterPresetId)
      ?? SCATTER_PRESETS[0];

    const winPocket = outcome.winningBallId !== null ? POCKETS[outcome.winningPocketId] : null;

    // ── Cue ball: show, pullback, strike, travel ──────────────────────────────
    const rackImpactX = RACK_POSITIONS[0].x;
    const rackImpactY = RACK_POSITIONS[0].y + BALL_RADIUS + 2;
    const cueX = outcome.cueBallSpawnX;
    const cueY = outcome.cueBallSpawnY;

    this.cueBall.rotation = Math.atan2(rackImpactX - cueX, cueY - rackImpactY);
    await this.cueBall.showAt(cueX, cueY);
    await this.cueBall.animateStrike();
    await this.cueBall.travelTo(rackImpactX, rackImpactY, 0.22);

    this.cueBall.impact();
    this.table.addTableShake();
    this.table.rackImpactFlash(rackImpactX, rackImpactY);
    await sleep(60);
    this.cueBall.disappear();

    // ── Build physics state for all 15 balls ──────────────────────────────────
    const firstPocketSec = outcome.firstPocketTimeSec;
    // Guidance begins at 35 % of the pocket window — enough lead-time to
    // steer smoothly without an obvious last-second lunge.
    const guidanceStart  = firstPocketSec * 0.35;

    const states: BallState[] = this.balls.map((ball, i) => {
      const ballId      = ball.ballId;
      const vel         = presetData.velocities[i];
      const isWinner    = outcome.winningBallId !== null && ballId === outcome.winningBallId;
      const isNearMiss  = ballId === outcome.nearMissBallId;
      const isSecondary = outcome.secondaryPocketedBallIds?.includes(ballId) ?? false;

      // ±10 % jitter for visual variety; the speed gradient is in the preset.
      const speed = vel.speed * (0.90 + Math.random() * 0.20);

      const st: BallState = {
        ball,
        vx:      vel.vx * speed,
        vy:      vel.vy * speed,
        retain:  isWinner ? WINNER_RETAIN : ROLLING_RETAIN,
        role:    isWinner    ? 'winner'
               : isNearMiss  ? 'nearMiss'
               : isSecondary ? 'secondary'
               : 'normal',
        active:   true,
        pocketed: false,
      };

      if (isWinner && winPocket) {
        st.pocketX       = winPocket.x;
        st.pocketY       = winPocket.y;
        st.guidanceStart = guidanceStart;
        st.pocketTime    = firstPocketSec;
        st.pocketId      = outcome.winningPocketId;
      }

      if (isNearMiss && outcome.nearMissPocketId !== undefined) {
        const nmP      = POCKETS[outcome.nearMissPocketId];
        st.nmPocketX   = nmP.x;
        st.nmPocketY   = nmP.y;
        st.nmDeflectAt = firstPocketSec * 0.62;
        st.nmDeflected = false;
      }

      if (isSecondary) {
        const secP     = POCKETS[(outcome.winningPocketId + 2) % 6];
        st.secPocketX  = secP.x;
        st.secPocketY  = secP.y;
        st.secPocketAt = firstPocketSec + 0.65;
      }

      return st;
    });

    // ── Physics loop ──────────────────────────────────────────────────────────
    // For null-winner outcomes (cue scratch / house), resolve shortly after
    // the first-pocket window expires rather than waiting for the 6.5 s safety.
    const nullWinnerResolveAt = outcome.winningBallId === null
      ? firstPocketSec + 0.85
      : Infinity;

    return new Promise<void>((resolve) => {
      let elapsed          = 0;
      let winnerPocketedAt: number | null = null;

      const update: TickerFn = ({ deltaMS }) => {
        const dt = Math.min(deltaMS / 1000, 0.05);
        elapsed += dt;

        // ── Pass 1: steering + position integration ───────────────────────────
        for (const bs of states) {
          if (bs.pocketed) continue;

          // ── Winner: soft velocity steering toward pocket ──────────────────
          if (bs.role === 'winner') {
            const tx   = bs.pocketX! - bs.ball.x;
            const ty   = bs.pocketY! - bs.ball.y;
            const dist = Math.sqrt(tx * tx + ty * ty) + 0.001;

            // Pocket capture: close enough, OR time overrun safety
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

            // Steering: smoothly bend velocity toward direction + speed needed
            // to arrive at pocket on time.
            if (elapsed >= bs.guidanceStart!) {
              const timeLeft    = Math.max(bs.pocketTime! - elapsed, 0.04);
              const neededSpeed = Math.min(dist / timeLeft, 600);
              const desiredVx   = (tx / dist) * neededSpeed;
              const desiredVy   = (ty / dist) * neededSpeed;
              // Blend converges in ~0.25 s — organic, not a snap.
              const blend = Math.min(1.0, dt * 5.0);
              bs.vx += (desiredVx - bs.vx) * blend;
              bs.vy += (desiredVy - bs.vy) * blend;
            }
          }

          // ── Near-miss: physics approach then perpendicular deflect ────────
          if (bs.role === 'nearMiss' && !bs.nmDeflected && elapsed >= bs.nmDeflectAt!) {
            const tx   = bs.nmPocketX! - bs.ball.x;
            const ty   = bs.nmPocketY! - bs.ball.y;
            const dist = Math.sqrt(tx * tx + ty * ty) + 0.001;
            // Cancel the toward-pocket component and add a tangential kick.
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
            if (elapsed >= bs.secPocketAt - 0.9) {
              const timeLeft    = Math.max(bs.secPocketAt - elapsed, 0.04);
              const neededSpeed = Math.min(dist / timeLeft, 400);
              const desiredVx   = (tx / dist) * neededSpeed;
              const desiredVy   = (ty / dist) * neededSpeed;
              const blend = Math.min(1.0, dt * 3.5);
              bs.vx += (desiredVx - bs.vx) * blend;
              bs.vy += (desiredVy - bs.vy) * blend;
            }
          }

          // Integrate position
          bs.ball.x += bs.vx * dt;
          bs.ball.y += bs.vy * dt;
        }

        // ── Pass 2: ball-ball collision resolution ────────────────────────────
        // Runs after integration so balls that just moved into overlap are caught.
        resolveCollisions(states);

        // ── Pass 3: rails, friction, stopping, pocket capture ─────────────────
        const R = BALL_RADIUS;
        for (const bs of states) {
          if (bs.pocketed) continue;

          // Cushion bounce — reflect with energy loss.
          // Corner-pocket gaps are handled implicitly: balls moving toward a
          // pocket opening won't hit the cushion there.
          if (bs.ball.x < FELT.left + R) {
            bs.ball.x = FELT.left + R;
            bs.vx = Math.abs(bs.vx) * RAIL_RETENTION;
          } else if (bs.ball.x > FELT.right - R) {
            bs.ball.x = FELT.right - R;
            bs.vx = -Math.abs(bs.vx) * RAIL_RETENTION;
          }
          if (bs.ball.y < FELT.top + R) {
            bs.ball.y = FELT.top + R;
            bs.vy = Math.abs(bs.vy) * RAIL_RETENTION;
          } else if (bs.ball.y > FELT.bottom - R) {
            bs.ball.y = FELT.bottom - R;
            bs.vy = -Math.abs(bs.vy) * RAIL_RETENTION;
          }

          // Rolling friction — exponential speed decay each frame.
          const f = Math.pow(bs.retain, dt);
          bs.vx *= f;
          bs.vy *= f;

          // Threshold stop — ball fully halts rather than drifting forever.
          if (bs.vx * bs.vx + bs.vy * bs.vy < STOP_SPEED * STOP_SPEED) {
            bs.vx = 0;
            bs.vy = 0;
          }

          // Natural pocket capture for all non-winner balls.
          // Any ball that reaches a pocket opening gets pocketed cleanly,
          // just as it would on a real table.
          if (bs.role !== 'winner') {
            for (const pocket of POCKETS) {
              const pdx = pocket.x - bs.ball.x;
              const pdy = pocket.y - bs.ball.y;
              if (pdx * pdx + pdy * pdy < POCKET_RADIUS * POCKET_RADIUS) {
                bs.pocketed = true;
                bs.active   = false;
                bs.ball.pocket();
                break;
              }
            }
          }
        }

        // ── Resolve: settle 0.85 s after winner pockets ───────────────────────
        if (winnerPocketedAt !== null && elapsed - winnerPocketedAt >= 0.85) {
          this.cleanup(states, update, resolve);
          return;
        }
        // Null-winner outcome: resolve after the expected pocket window
        if (elapsed >= nullWinnerResolveAt) {
          this.cleanup(states, update, resolve);
          return;
        }
        // Safety timeout
        if (elapsed >= 6.5) {
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

import { gsap } from 'gsap';
import { BallSprite } from '../objects/BallSprite';
import { CueBall }    from '../objects/CueBall';
import { PoolTable }  from '../objects/PoolTable';
import { RoundOutcome } from '../state/GameState';
import {
  RACK_POSITIONS, CUE_BALL_PRESETS, POCKETS,
  FELT, BALL_RADIUS,
} from '../config/gameConfig';
import { SCATTER_PRESETS as SCATTER_PRESETS_DATA } from '../config/scatterPresets';

interface Waypoint { x: number; y: number; dur: number; ease: string }

export class AnimationController {
  private balls:   BallSprite[];
  private cueBall: CueBall;
  private table:   PoolTable;

  constructor(balls: BallSprite[], cueBall: CueBall, table: PoolTable) {
    this.balls   = balls;
    this.cueBall = cueBall;
    this.table   = table;
  }

  /** Play the full round animation. Returns a Promise that resolves when done. */
  async play(outcome: RoundOutcome): Promise<void> {
    const preset = SCATTER_PRESETS_DATA.find(p => p.id === outcome.scatterPresetId)
      ?? SCATTER_PRESETS_DATA[0];

    const cuePre = CUE_BALL_PRESETS[outcome.cueBallStartPresetId];
    const winPocket = POCKETS[outcome.winningPocketId];

    // ── 1. Show cue ball + stick ──────────────────────────────────────────────
    await this.cueBall.showAt(cuePre.x, cuePre.y);

    // ── 2. Cue strike animation ───────────────────────────────────────────────
    await this.cueBall.animateStrike();

    // ── 3. Cue ball travels to rack ───────────────────────────────────────────
    // Aim slightly above the bottom row of the rack
    const rackImpactY = RACK_POSITIONS[6].y + BALL_RADIUS + 2;
    const rackImpactX = RACK_POSITIONS[4].x; // centre
    await this.cueBall.travelTo(rackImpactX, rackImpactY, 0.22);

    // ── 4. Impact ─────────────────────────────────────────────────────────────
    this.cueBall.impact();
    this.table.addTableShake();
    await sleep(60);
    this.cueBall.disappear();

    // ── 5. Scatter all balls simultaneously ───────────────────────────────────
    const winnerBall = this.balls[outcome.winningBallId - 1]; // 0-indexed array
    const winnerPocketPos = { x: winPocket.x, y: winPocket.y };
    const firstPocketSec  = outcome.firstPocketTimeSec;

    const scatterPromises: Promise<void>[] = [];

    for (let i = 0; i < this.balls.length; i++) {
      const ball    = this.balls[i];
      const ballId  = i + 1;
      const vel     = preset.velocities[i];
      const startX  = RACK_POSITIONS[i].x;
      const startY  = RACK_POSITIONS[i].y;

      const isWinner   = ballId === outcome.winningBallId;
      const isNearMiss = ballId === outcome.nearMissBallId;
      const isSecondary = outcome.secondaryPocketedBallIds?.includes(ballId) ?? false;

      let waypoints: Waypoint[];

      if (isWinner) {
        waypoints = this.winnerPath(startX, startY, vel.vx, vel.vy, winnerPocketPos, firstPocketSec);
      } else if (isNearMiss && outcome.nearMissPocketId !== undefined) {
        const nmPocket = POCKETS[outcome.nearMissPocketId];
        waypoints = this.nearMissPath(startX, startY, vel.vx, vel.vy, nmPocket, firstPocketSec);
      } else if (isSecondary) {
        const secondaryPocket = POCKETS[(outcome.winningPocketId + 2) % 6];
        waypoints = this.secondaryPath(startX, startY, vel.vx, vel.vy, secondaryPocket, firstPocketSec + 0.5);
      } else {
        waypoints = this.scatterPath(startX, startY, vel.vx, vel.vy, vel.speed);
      }

      scatterPromises.push(this.animateBall(ball, waypoints, {
        isWinner,
        isNearMiss: isNearMiss && outcome.nearMissPocketId !== undefined,
        pocketPos: isWinner ? winnerPocketPos : undefined,
        firstPocketSec,
        isSecondary,
        secondaryPocketPos: isSecondary
          ? { x: POCKETS[(outcome.winningPocketId + 2) % 6].x, y: POCKETS[(outcome.winningPocketId + 2) % 6].y }
          : undefined,
        secondaryPocketSec: firstPocketSec + 0.5,
        pocketIdForFlash: isWinner ? outcome.winningPocketId : undefined,
      }));
    }

    // Wait for all balls to finish (winner pockets first, others settle)
    await Promise.all(scatterPromises);
  }

  private async animateBall(
    ball: BallSprite,
    waypoints: Waypoint[],
    opts: {
      isWinner:          boolean;
      isNearMiss:        boolean;
      pocketPos?:        { x: number; y: number };
      firstPocketSec:    number;
      isSecondary:       boolean;
      secondaryPocketPos?: { x: number; y: number };
      secondaryPocketSec?: number;
      pocketIdForFlash?: number;
    },
  ): Promise<void> {
    let elapsed = 0;
    for (const wp of waypoints) {
      await new Promise<void>(resolve => {
        gsap.to(ball, {
          x: wp.x, y: wp.y,
          duration: wp.dur,
          ease: wp.ease,
          onComplete: resolve,
        });
      });
      elapsed += wp.dur;

      // Winner: pocket after last movement waypoint
      if (opts.isWinner && elapsed >= opts.firstPocketSec - 0.05) {
        await new Promise<void>(resolve => ball.pocket(resolve));
        if (opts.pocketIdForFlash !== undefined) {
          this.table.flashPocket(opts.pocketIdForFlash);
        }
        break;
      }

      // Secondary: pocket after its waypoints
      if (opts.isSecondary && elapsed >= (opts.secondaryPocketSec ?? 99)) {
        await new Promise<void>(resolve => ball.pocket(resolve));
        break;
      }
    }
  }

  // ─── Path generators ──────────────────────────────────────────────────────

  /** Winner moves toward pocket in two stages: scatter then guided approach. */
  private winnerPath(
    sx: number, sy: number,
    vx: number, vy: number,
    pocket: { x: number; y: number },
    totalSec: number,
  ): Waypoint[] {
    const scatter = clamp2d(sx + vx * 55, sy + vy * 55);
    const t1 = totalSec * 0.38;
    const t2 = totalSec * 0.62;
    return [
      { x: scatter.x, y: scatter.y, dur: t1, ease: 'power3.out' },
      { x: pocket.x,  y: pocket.y,  dur: t2, ease: 'power1.in'  },
    ];
  }

  /** Near-miss ball approaches pocket but deflects before dropping in. */
  private nearMissPath(
    sx: number, sy: number,
    vx: number, vy: number,
    pocket: { x: number; y: number },
    winnerTimeSec: number,
  ): Waypoint[] {
    const arriveTime = winnerTimeSec - 0.35;
    const dx = pocket.x - sx;
    const dy = pocket.y - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Approach to within ~34 px of pocket centre
    const approachX = pocket.x - (dx / dist) * (BALL_RADIUS + 32);
    const approachY = pocket.y - (dy / dist) * (BALL_RADIUS + 32);
    // Deflect perpendicular
    const deflectX = clamp(approachX + (dy / dist) * 44, FELT.left + 15, FELT.right - 15);
    const deflectY = clamp(approachY - (dx / dist) * 44, FELT.top  + 15, FELT.bottom - 15);
    // Come to rest
    const restX = clamp(deflectX + vx * 30, FELT.left + 15, FELT.right - 15);
    const restY = clamp(deflectY + vy * 30, FELT.top  + 15, FELT.bottom - 15);

    return [
      { x: clamp2d(sx + vx * 45, sy + vy * 45).x,
        y: clamp2d(sx + vx * 45, sy + vy * 45).y,
        dur: arriveTime * 0.35, ease: 'power2.out' },
      { x: approachX, y: approachY, dur: arriveTime * 0.50, ease: 'power2.out' },
      { x: deflectX,  y: deflectY,  dur: 0.22,              ease: 'power2.in'  },
      { x: restX,     y: restY,     dur: 0.55,              ease: 'power3.out' },
    ];
  }

  private secondaryPath(
    sx: number, sy: number,
    vx: number, vy: number,
    pocket: { x: number; y: number },
    totalSec: number,
  ): Waypoint[] {
    const mid = clamp2d(sx + vx * 70, sy + vy * 55);
    const t1  = totalSec * 0.55;
    const t2  = totalSec * 0.45;
    return [
      { x: mid.x,    y: mid.y,    dur: t1, ease: 'power3.out' },
      { x: pocket.x, y: pocket.y, dur: t2, ease: 'power1.in'  },
    ];
  }

  /** Generic scatter: move fast then decelerate onto the felt. */
  private scatterPath(
    sx: number, sy: number,
    vx: number, vy: number,
    speed: number,
  ): Waypoint[] {
    // Primary scatter destination
    const dist    = speed * 0.80;
    let endX      = sx + vx * dist;
    let endY      = sy + vy * dist;

    // Wall bounce check
    const hasBounce =
      endX < FELT.left  + BALL_RADIUS + 8 ||
      endX > FELT.right - BALL_RADIUS - 8 ||
      endY < FELT.top   + BALL_RADIUS + 8 ||
      endY > FELT.bottom - BALL_RADIUS - 8;

    if (hasBounce) {
      const midX  = clamp(sx + vx * dist * 0.45, FELT.left + 16, FELT.right - 16);
      const midY  = clamp(sy + vy * dist * 0.45, FELT.top  + 16, FELT.bottom - 16);
      endX = clamp(endX, FELT.left + 16, FELT.right - 16);
      endY = clamp(endY, FELT.top  + 16, FELT.bottom - 16);
      return [
        { x: midX, y: midY, dur: 0.42, ease: 'power1.out' },
        { x: endX, y: endY, dur: 0.55, ease: 'power3.out' },
      ];
    }

    endX = clamp(endX, FELT.left + 16, FELT.right - 16);
    endY = clamp(endY, FELT.top  + 16, FELT.bottom - 16);
    return [
      { x: endX, y: endY, dur: 0.78, ease: 'power3.out' },
    ];
  }

  /** Kill all ongoing gsap tweens — called on reset. */
  killAll(): void {
    gsap.killTweensOf(this.cueBall);
    gsap.killTweensOf(this.cueBall.stick);
    gsap.killTweensOf(this.cueBall.scale);
    for (const ball of this.balls) {
      gsap.killTweensOf(ball);
      gsap.killTweensOf(ball.scale);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function clamp2d(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x, FELT.left  + BALL_RADIUS + 4, FELT.right  - BALL_RADIUS - 4),
    y: clamp(y, FELT.top   + BALL_RADIUS + 4, FELT.bottom - BALL_RADIUS - 4),
  };
}
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

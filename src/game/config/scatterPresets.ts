/**
 * Scatter presets – pre-authored ball velocity vectors for the cinematic
 * break animation.  Each entry contains one velocity per rack slot (0–14),
 * matching the RACK_POSITIONS array in gameConfig.ts.
 *
 * Slot layout reminder (apex = slot 0, closest to cue ball):
 *
 *   Row 5 (back):  [10][11][12][13][14]   y ≈  92   (small Y, top of screen)
 *   Row 4:              [6][7][8][9]       y ≈ 111
 *   Row 3 (centre):       [3][4][5]        y ≈ 130   (slot 4 = 8-ball)
 *   Row 2:                  [1][2]         y ≈ 149
 *   Row 1 (apex):              [0]         y ≈ 168   (large Y, close to cue)
 *
 * Speed structure (px/s) — tuned for the ball-ball collision physics model.
 * With ROLLING_RETAIN = 0.14 and real collision propagation, front balls
 * don't need to be launched at arcade speeds; the cascade carries energy
 * through the rack naturally.
 *
 *   Row 1 (apex)   :  280–295  direct hit
 *   Row 2          :  265–280  absorbs cascade
 *   Row 3          :  190–210  mid energy
 *   Row 4          :  125–140  propagated
 *   Row 5 (back)   :   78–90   least energy
 *
 * Coordinate convention: vy < 0 = moves toward top of screen (away from cue).
 */

export interface BallVelocity {
  vx: number;    // normalised X  (-1..1)
  vy: number;    // normalised Y  (-1..1)
  speed: number; // px/s at impact
}

export interface ScatterPreset {
  id: string;
  /** velocity[i] corresponds to RACK_POSITIONS[i] (slot i) */
  velocities: BallVelocity[];
}

function nv(x: number, y: number, speed: number): BallVelocity {
  const len = Math.sqrt(x * x + y * y) || 1;
  return { vx: x / len, vy: y / len, speed };
}

export const SCATTER_PRESETS: ScatterPreset[] = [
  // ── Preset 1: straight centre break ──────────────────────────────────────
  {
    id: 'center-hard',
    velocities: [
      //  slot  role             direction           speed
      nv( 0.30,  0.95,  290), //  0  apex            back + slight right
      nv(-0.75, -0.65,  275), //  1  row2-left        hard up-left
      nv( 0.75, -0.65,  275), //  2  row2-right       hard up-right
      nv(-0.95, -0.30,  205), //  3  row3-left        mostly left + slight up
      nv( 0.00, -1.00,  195), //  4  row3-center(8)  straight up
      nv( 0.95, -0.30,  205), //  5  row3-right       mostly right + slight up
      nv(-0.90, -0.45,  138), //  6  row4-far-left    hard left+up
      nv(-0.35, -0.94,  130), //  7  row4-mid-left    mostly up, left lean
      nv( 0.35, -0.94,  130), //  8  row4-mid-right   mostly up, right lean
      nv( 0.90, -0.45,  138), //  9  row4-far-right   hard right+up
      nv(-0.88, -0.47,   88), // 10  back-far-left    hard left
      nv(-0.45, -0.90,   82), // 11  back-mid-left    up-left
      nv( 0.05, -1.00,   85), // 12  back-centre      straight up
      nv( 0.45, -0.90,   82), // 13  back-mid-right   up-right
      nv( 0.88, -0.47,   88), // 14  back-far-right   hard right
    ],
  },

  // ── Preset 2: left-angle break ───────────────────────────────────────────
  {
    id: 'left-angle',
    velocities: [
      nv( 0.55,  0.84,  290), //  0  apex            back-right
      nv(-0.45, -0.89,  270), //  1  row2-left        up with left pull
      nv( 0.88, -0.48,  278), //  2  row2-right       hard right+up
      nv(-0.75, -0.66,  200), //  3  row3-left        up-left
      nv( 0.20, -0.98,  192), //  4  row3-center(8)  up with right lean
      nv( 0.95, -0.30,  208), //  5  row3-right       hard right
      nv(-0.85, -0.52,  130), //  6  row4-far-left    left+up
      nv(-0.15, -0.99,  127), //  7  row4-mid-left    mostly up
      nv( 0.55, -0.83,  133), //  8  row4-mid-right   up-right
      nv( 0.90, -0.44,  140), //  9  row4-far-right   hard right+up
      nv(-0.80, -0.60,   85), // 10  back-far-left    left
      nv(-0.35, -0.94,   78), // 11  back-mid-left    up-left lean
      nv( 0.15, -0.99,   83), // 12  back-centre      up-right lean
      nv( 0.55, -0.84,   81), // 13  back-mid-right   up-right
      nv( 0.88, -0.47,   88), // 14  back-far-right   hard right
    ],
  },

  // ── Preset 3: right-angle break (mirror of left-angle) ───────────────────
  {
    id: 'right-angle',
    velocities: [
      nv(-0.55,  0.84,  290), //  0  apex            back-left
      nv(-0.88, -0.48,  278), //  1  row2-left        hard left+up
      nv( 0.45, -0.89,  270), //  2  row2-right       up with right pull
      nv(-0.95, -0.30,  208), //  3  row3-left        hard left
      nv(-0.20, -0.98,  192), //  4  row3-center(8)  up with left lean
      nv( 0.75, -0.66,  200), //  5  row3-right       up-right
      nv(-0.90, -0.44,  140), //  6  row4-far-left    hard left+up
      nv(-0.55, -0.83,  133), //  7  row4-mid-left    up-left
      nv( 0.15, -0.99,  127), //  8  row4-mid-right   mostly up
      nv( 0.85, -0.52,  130), //  9  row4-far-right   right+up
      nv(-0.88, -0.47,   88), // 10  back-far-left    hard left
      nv(-0.55, -0.84,   81), // 11  back-mid-left    up-left
      nv(-0.15, -0.99,   83), // 12  back-centre      up-left lean
      nv( 0.35, -0.94,   78), // 13  back-mid-right   up-right lean
      nv( 0.80, -0.60,   85), // 14  back-far-right   right
    ],
  },

  // ── Preset 4: soft centre break ──────────────────────────────────────────
  {
    id: 'soft-center',
    velocities: [
      nv( 0.20,  0.98,  208), //  0  apex            gently back
      nv(-0.72, -0.70,  200), //  1  row2-left        up-left
      nv( 0.72, -0.70,  200), //  2  row2-right       up-right
      nv(-0.92, -0.38,  153), //  3  row3-left        mostly left
      nv( 0.00, -1.00,  144), //  4  row3-center(8)  up
      nv( 0.92, -0.38,  153), //  5  row3-right       mostly right
      nv(-0.88, -0.47,  101), //  6  row4-far-left    left+up
      nv(-0.30, -0.95,   96), //  7  row4-mid-left    up-left
      nv( 0.30, -0.95,   96), //  8  row4-mid-right   up-right
      nv( 0.88, -0.47,  101), //  9  row4-far-right   right+up
      nv(-0.85, -0.52,   65), // 10  back-far-left    left
      nv(-0.42, -0.91,   60), // 11  back-mid-left    up-left
      nv( 0.05, -1.00,   64), // 12  back-centre      up
      nv( 0.42, -0.91,   60), // 13  back-mid-right   up-right
      nv( 0.85, -0.52,   65), // 14  back-far-right   right
    ],
  },
];

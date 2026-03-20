/**
 * Scatter presets – pre-authored ball velocity vectors used for the
 * cinematic break animation.  Each entry gives every ball in the rack
 * (positions 0-7 matching RACK_POSITIONS) a normalised direction vector
 * and a speed scalar.  These are used by AnimationController to produce
 * believable scatter paths without real physics deciding the winner.
 */

export interface BallVelocity {
  vx: number;   // normalised X component (-1..1)
  vy: number;   // normalised Y component (-1..1)
  speed: number; // px/s at impact
}

export interface ScatterPreset {
  id: string;
  cueBallPresetId: number; // index into CUE_BALL_PRESETS
  /** velocity[i] corresponds to RACK_POSITIONS[i] */
  velocities: BallVelocity[];
}

// Helper to normalise a vector
function nv(x: number, y: number, speed: number): BallVelocity {
  const len = Math.sqrt(x * x + y * y) || 1;
  return { vx: x / len, vy: y / len, speed };
}

export const SCATTER_PRESETS: ScatterPreset[] = [
  {
    id: 'center-hard',
    cueBallPresetId: 1,
    velocities: [
      nv( 0,   -1,   320), // 0 apex – straight up fast
      nv(-0.7, -0.7, 280), // 1
      nv( 0.7, -0.7, 280), // 2
      nv(-1,   -0.2, 240), // 3
      nv( 0,   -0.5, 200), // 4 centre
      nv( 1,   -0.2, 240), // 5
      nv(-0.6,  0.8, 200), // 6
      nv( 0.6,  0.8, 200), // 7
    ],
  },
  {
    id: 'left-angle',
    cueBallPresetId: 0,
    velocities: [
      nv( 0.2, -1,   310), // 0
      nv(-0.5, -0.8, 270), // 1
      nv( 0.8, -0.6, 260), // 2
      nv(-0.9, -0.3, 230), // 3
      nv( 0.1, -0.4, 190), // 4
      nv( 0.9, -0.2, 250), // 5
      nv(-0.4,  0.9, 195), // 6
      nv( 0.7,  0.7, 210), // 7
    ],
  },
  {
    id: 'right-angle',
    cueBallPresetId: 2,
    velocities: [
      nv(-0.2, -1,   315), // 0
      nv(-0.8, -0.6, 265), // 1
      nv( 0.5, -0.8, 275), // 2
      nv(-0.9, -0.2, 245), // 3
      nv(-0.1, -0.4, 195), // 4
      nv( 0.9, -0.3, 235), // 5
      nv(-0.7,  0.7, 205), // 6
      nv( 0.4,  0.9, 200), // 7
    ],
  },
  {
    id: 'soft-center',
    cueBallPresetId: 3,
    velocities: [
      nv( 0,   -1,   260), // 0
      nv(-0.6, -0.8, 220), // 1
      nv( 0.6, -0.8, 220), // 2
      nv(-0.8, -0.3, 195), // 3
      nv( 0,   -0.6, 170), // 4
      nv( 0.8, -0.3, 195), // 5
      nv(-0.5,  0.8, 165), // 6
      nv( 0.5,  0.8, 165), // 7
    ],
  },
];

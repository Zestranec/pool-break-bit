/**
 * Rack generation — standard 8-ball pool arrangement, seed-deterministic.
 *
 * Triangle slot layout (15 balls, apex closest to cue ball):
 *
 *   Row 5 (back, far from cue):  [10][11][12][13][14]
 *   Row 4:                           [6][7][8][9]
 *   Row 3 (center):                    [3][4][5]   ← [4] = 8-ball always
 *   Row 2:                               [1][2]
 *   Row 1 (apex, close to cue):            [0]
 *
 * Rules applied:
 *   • slot 4 = ball 8 (always)
 *   • slots 10 & 14 (back corners) = one solid (1-7) + one stripe (9-15)
 *   • remaining 12 slots shuffled from the remaining 12 balls
 *
 * Returns an array of 15 ballIds indexed by slot [0..14].
 */

import { ProbabilityController } from '../controllers/ProbabilityController';

const SOLIDS  = [1, 2, 3, 4, 5, 6, 7] as const;
const STRIPES = [9, 10, 11, 12, 13, 14, 15] as const;

export function generateRack(seed: number): number[] {
  const rng  = new ProbabilityController(seed);
  const rack = new Array<number>(15).fill(0);

  // ── Fixed: 8-ball in center ──────────────────────────────────────────────
  rack[4] = 8;

  // ── Fixed: back corners — one solid, one stripe ──────────────────────────
  const cornerSolid  = SOLIDS [rng.nextInt(SOLIDS.length)];
  const cornerStripe = STRIPES[rng.nextInt(STRIPES.length)];

  if (rng.next() < 0.5) {
    rack[10] = cornerSolid;
    rack[14] = cornerStripe;
  } else {
    rack[10] = cornerStripe;
    rack[14] = cornerSolid;
  }

  // ── Build pool of remaining balls ────────────────────────────────────────
  const used = new Set([8, cornerSolid, cornerStripe]);
  const remaining: number[] = [];
  for (let id = 1; id <= 15; id++) {
    if (!used.has(id)) remaining.push(id);
  }

  // ── Fisher-Yates shuffle of remaining 12 balls ───────────────────────────
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // ── Fill the 12 free slots in order ──────────────────────────────────────
  let ri = 0;
  for (let slot = 0; slot < 15; slot++) {
    if (rack[slot] === 0) rack[slot] = remaining[ri++];
  }

  return rack;
}

/**
 * Ball catalogue — single source of truth for pool ball identity.
 *
 * Standard 8-ball pool set:
 *   Solids  1-7   (yellow · blue · red · purple · orange · green · maroon)
 *   Black   8     (the 8-ball)
 *   Stripes 9-15  (same color order as 1-7)
 *   Cue     0     (white, no number — rendered by CueBall.ts, listed for completeness)
 */

export type BallType = 'solid' | 'stripe' | 'black' | 'cue';

export interface BallDef {
  /** Standard pool ball number (1-15; 0 = cue ball). */
  id:    number;
  type:  BallType;
  /** Primary swatch color — used for the solid fill or stripe band. */
  color: number;
}

// Real-life color references:
//  1/9  – yellow   BCA standard ~Pantone 109 C
//  2/10 – blue     BCA standard ~Pantone 287 C
//  3/11 – red      BCA standard ~Pantone 185 C
//  4/12 – purple   BCA standard ~Pantone 268 C
//  5/13 – orange   BCA standard ~Pantone 021 C
//  6/14 – green    BCA standard ~Pantone 356 C
//  7/15 – maroon   BCA standard ~Pantone 7421 C
const Y = 0xF5D400; // yellow
const B = 0x005DA6; // blue
const R = 0xCC1100; // red
const P = 0x660099; // purple
const O = 0xFF6600; // orange
const G = 0x006B3C; // green
const M = 0x8C0022; // maroon (dark red)

export const BALL_DEFS: readonly BallDef[] = [
  // ── Solids ──────────────────────────────────────────────────────────────────
  { id:  1, type: 'solid',  color: Y },
  { id:  2, type: 'solid',  color: B },
  { id:  3, type: 'solid',  color: R },
  { id:  4, type: 'solid',  color: P },
  { id:  5, type: 'solid',  color: O },
  { id:  6, type: 'solid',  color: G },
  { id:  7, type: 'solid',  color: M },
  // ── 8-ball ──────────────────────────────────────────────────────────────────
  { id:  8, type: 'black',  color: 0x111111 },
  // ── Stripes (same color order as 1–7) ───────────────────────────────────────
  { id:  9, type: 'stripe', color: Y },
  { id: 10, type: 'stripe', color: B },
  { id: 11, type: 'stripe', color: R },
  { id: 12, type: 'stripe', color: P },
  { id: 13, type: 'stripe', color: O },
  { id: 14, type: 'stripe', color: G },
  { id: 15, type: 'stripe', color: M },
  // ── Cue ball (visual handled by CueBall.ts) ──────────────────────────────────
  { id:  0, type: 'cue',   color: 0xf5f0e0 },
];

/** Look up a ball definition by id. Falls back to ball 1 if not found. */
export function getBallDef(id: number): BallDef {
  return BALL_DEFS.find(b => b.id === id) ?? BALL_DEFS[0];
}

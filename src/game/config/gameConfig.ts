// ─── Canvas / design space ─────────────────────────────────────────────────
export const DESIGN_WIDTH  = 400;
export const DESIGN_HEIGHT = 640;   // +20 to accommodate taller table

// ─── Pool table ─────────────────────────────────────────────────────────────
export const TABLE = {
  x: 0,
  y: 0,
  width:  400,
  height: 340,             // was 246 — now dominates ~53 % of viewport height
  borderWidth: 18,
  feltColor:       0x1e7a46,
  cushionColor:    0x165f35,
  borderColor:     0x4a1e08,
  borderColorHi:   0x7a3410,
  pocketColor:     0x080808,
} as const;

export const BALL_RADIUS   = 13;
export const POCKET_RADIUS = 17;

// Felt interior bounds — balls live here
export const FELT = {
  left:   TABLE.borderWidth,                    // 18
  right:  TABLE.width  - TABLE.borderWidth,     // 382
  top:    TABLE.borderWidth,                    // 18
  bottom: TABLE.height - TABLE.borderWidth,     // 322
} as const;

// ─── Pocket positions (at felt-boundary corners / mid-rails) ────────────────
// Placed exactly on FELT bounds so the physics capture radius covers them.
export const POCKETS = [
  { id: 0, x: FELT.left,            y: FELT.top    }, // TL
  { id: 1, x: TABLE.width / 2,      y: FELT.top    }, // TM
  { id: 2, x: FELT.right,           y: FELT.top    }, // TR
  { id: 3, x: FELT.left,            y: FELT.bottom }, // BL
  { id: 4, x: TABLE.width / 2,      y: FELT.bottom }, // BM
  { id: 5, x: FELT.right,           y: FELT.bottom }, // BR
] as const;

// ─── Rack positions: 1-2-3-2 diamond, 8 balls ───────────────────────────────
const RCX = TABLE.width / 2;   // 200
const RCY = 150;                // rack centre-Y; ~44 % down the felt interior
const HS  = 29;                 // horizontal spacing
const VS  = 25;                 // vertical   spacing (≈ cos30° × HS)

export const RACK_POSITIONS: Array<{ x: number; y: number }> = [
  { x: RCX,          y: RCY - VS * 1.5 }, // 0 – apex
  { x: RCX - HS / 2, y: RCY - VS * 0.5 }, // 1
  { x: RCX + HS / 2, y: RCY - VS * 0.5 }, // 2
  { x: RCX - HS,     y: RCY + VS * 0.5 }, // 3
  { x: RCX,          y: RCY + VS * 0.5 }, // 4 – centre
  { x: RCX + HS,     y: RCY + VS * 0.5 }, // 5
  { x: RCX - HS / 2, y: RCY + VS * 1.5 }, // 6
  { x: RCX + HS / 2, y: RCY + VS * 1.5 }, // 7
];

// ─── Cue ball start presets (lower "kitchen" area) ──────────────────────────
// Y values scale with the larger felt height (felt bottom is now 322).
export const CUE_BALL_PRESETS = [
  { id: 0, x: 162, y: 283 },
  { id: 1, x: 200, y: 291 },
  { id: 2, x: 238, y: 283 },
  { id: 3, x: 180, y: 276 },
  { id: 4, x: 220, y: 276 },
] as const;

// ─── Ball visual colours ─────────────────────────────────────────────────────
export const BALL_COLORS: readonly number[] = [
  0xF4D03F, // 1 – yellow
  0x2980B9, // 2 – blue
  0xE74C3C, // 3 – red
  0x7D3C98, // 4 – purple
  0xE67E22, // 5 – orange
  0x1E8449, // 6 – green
  0x922B21, // 7 – maroon
  0x212121, // 8 – black
];

export const BALL_COUNT = 8;

// ─── HUD layout (all Y coords shifted down to match taller table) ────────────
export const HUD = {
  topY:          350,
  balanceY:      362,
  labelY:        405,
  ballSelectorY: 450,  // centre-line of selector chips
  betLabelY:     496,
  betRowY:       530,
  breakButtonY:  590,
  breakButtonW:  200,
  breakButtonH:  58,
} as const;

// ─── Animation timing (seconds unless noted) ────────────────────────────────
export const ANIM = {
  cueFadeIn:       0.25,
  cuePullback:     0.35,
  cueStrike:       0.18,
  cueBallTravel:   0.22,
  impactPauseMs:   60,
  scatterStart:    0.80,
  firstPocketMin:  1.80,   // slightly longer for the larger table
  firstPocketMax:  2.40,
  settleAfter:     0.85,
  resolveDelay:    0.30,
} as const;

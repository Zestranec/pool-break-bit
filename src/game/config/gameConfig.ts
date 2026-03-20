// ─── Canvas / design space ─────────────────────────────────────────────────
export const DESIGN_WIDTH  = 400;
export const DESIGN_HEIGHT = 620;

// ─── Pool table ─────────────────────────────────────────────────────────────
export const TABLE = {
  x: 0,
  y: 0,
  width:  400,
  height: 246,
  borderWidth: 18,        // rail thickness
  feltColor:       0x1e7a46,
  cushionColor:    0x165f35,
  borderColor:     0x4a1e08,
  borderColorHi:   0x7a3410,
  pocketColor:     0x080808,
} as const;

export const BALL_RADIUS   = 13;
export const POCKET_RADIUS = 17;

// Felt interior bounds (balls live here)
export const FELT = {
  left:   TABLE.borderWidth,
  right:  TABLE.width  - TABLE.borderWidth,
  top:    TABLE.borderWidth,
  bottom: TABLE.height - TABLE.borderWidth,
} as const;

// ─── Pocket positions (screen coords, centre of hole) ───────────────────────
export const POCKETS = [
  { id: 0, x: 16,             y: 16              }, // TL
  { id: 1, x: TABLE.width / 2, y: 6              }, // TM
  { id: 2, x: TABLE.width - 16, y: 16            }, // TR
  { id: 3, x: 16,             y: TABLE.height - 16 }, // BL
  { id: 4, x: TABLE.width / 2, y: TABLE.height - 6 }, // BM
  { id: 5, x: TABLE.width - 16, y: TABLE.height - 16 }, // BR
] as const;

// ─── Rack positions: 1-2-3-2 diamond, 8 balls ───────────────────────────────
const RCX = TABLE.width / 2;   // 200
const RCY = 112;                // rack centre-Y on screen
const HS  = 27;                 // horizontal spacing between ball centres
const VS  = 23;                 // vertical   spacing (≈ cos30° × HS)

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
export const CUE_BALL_PRESETS = [
  { id: 0, x: 162, y: 200 },
  { id: 1, x: 200, y: 208 },
  { id: 2, x: 238, y: 200 },
  { id: 3, x: 178, y: 194 },
  { id: 4, x: 222, y: 194 },
] as const;

// ─── Ball visual colours ─────────────────────────────────────────────────────
// Eight numbered solid balls (1-8)
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

// ─── HUD layout (Y coords in design space) ──────────────────────────────────
export const HUD = {
  topY:          254, // first element below table
  balanceY:      270,
  labelY:        312,
  ballSelectorY: 358, // centre-line of selector chips
  betLabelY:     405,
  betRowY:       440,
  breakButtonY:  512,
  breakButtonW:  200,
  breakButtonH:  58,
} as const;

// ─── Animation timing (seconds unless noted) ────────────────────────────────
export const ANIM = {
  cueFadeIn:       0.25,  // cue ball & stick appear
  cuePullback:     0.35,
  cueStrike:       0.18,  // stick snaps forward
  cueBallTravel:   0.22,  // cue ball reaches rack
  impactPauseMs:   60,    // tiny freeze on impact
  scatterStart:    0.80,  // seconds into round when scatter begins
  firstPocketMin:  1.70,  // earliest the winner can pocket
  firstPocketMax:  2.30,
  settleAfter:     0.85,  // settle time after first pocket
  resolveDelay:    0.30,  // pause before showing result banner
} as const;

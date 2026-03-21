// ─── Canvas / design space ─────────────────────────────────────────────────
export const DESIGN_WIDTH  = 400;
export const DESIGN_HEIGHT = 750;   // tall enough for portrait table + compact HUD

// ─── Pool table outer frame ──────────────────────────────────────────────────
// Portrait layout — long axis runs top→bottom on screen.
//
//   Rail thickness  24 px
//   Felt width  = 400 − 2×24 = 352 px
//   Felt height = 452 px              → ratio 452/352 ≈ 1.28 : 1  (portrait ✓)
//   Table outer height = 452 + 48     = 500 px
//
export const TABLE = {
  x: 0,
  y: 0,
  width:        400,
  height:       500,   // portrait frame; felt interior = 352 × 452
  borderWidth:   24,
  feltColor:       0x1e7a46,
  cushionColor:    0x165f35,
  borderColor:     0x4a1e08,
  borderColorHi:   0x7a3410,
  pocketColor:     0x080808,
} as const;

export const BALL_RADIUS   = 11;
export const POCKET_RADIUS = 19;

// ─── Felt interior bounds ────────────────────────────────────────────────────
//   left = right = top = 24,  bottom = 500−24 = 476
//   interior W = 352,  interior H = 452  →  portrait ratio ✓
export const FELT = {
  left:   TABLE.borderWidth,                   //  24
  right:  TABLE.width  - TABLE.borderWidth,    // 376
  top:    TABLE.borderWidth,                   //  24
  bottom: TABLE.height - TABLE.borderWidth,    // 476
} as const;

// ─── Pocket positions ────────────────────────────────────────────────────────
// Portrait table — long axis is vertical.
//   Corner pockets: 4 corners of the felt rectangle.
//   Mid pockets: centered on the LEFT and RIGHT long rails (not short top/bottom rails).
export const POCKETS = [
  { id: 0, x: FELT.left,            y: FELT.top          }, // TL  ( 24, 24)
  { id: 1, x: FELT.left,            y: TABLE.height / 2  }, // LM  ( 24,250) ← long-rail mid
  { id: 2, x: FELT.right,           y: FELT.top          }, // TR  (376, 24)
  { id: 3, x: FELT.left,            y: FELT.bottom       }, // BL  ( 24,476)
  { id: 4, x: FELT.right,           y: TABLE.height / 2  }, // RM  (376,250) ← long-rail mid
  { id: 5, x: FELT.right,           y: FELT.bottom       }, // BR  (376,476)
] as const;

// ─── Rack positions: full 15-ball triangle ───────────────────────────────────
// Standard 8-ball rack — 5 rows, apex nearest the cue ball (bottom of screen).
//
//   Row 1 apex   slot  0   ← largest Y, closest to cue   (bottom)
//   Row 2        slots 1–2
//   Row 3        slots 3–5  ← slot 4 = 8-ball (geometric centre)
//   Row 4        slots 6–9
//   Row 5 back   slots 10–14  ← smallest Y, farthest from cue  (top)
//
// Ball spacing:
//   HS = 2 × BALL_RADIUS = 22 px  (horizontal)
//   VS = HS × sin60°     = 19 px  (vertical)
//
// RCY = 130 → foot spot at ≈ 24 % from felt top (standard pool placement)
//   back row: 130−38 =  92 → clearance from felt top = 92−24 = 68 px ✓
//   apex row: 130+38 = 168 → clearance from felt bottom = 476−168 = 308 px ✓
//
const RCX = TABLE.width / 2;  // 200
const RCY = 130;              // rack centre (moved up for portrait table)
const HS  = 22;               // = 2 × BALL_RADIUS
const VS  = 19;               // ≈ HS × sin60°

export const RACK_POSITIONS: Array<{ x: number; y: number }> = [
  // ── Row 1 — apex (closest to cue) ───────────────────────────────────────
  { x: RCX,             y: RCY + VS * 2 }, // slot  0  apex        (200,168)

  // ── Row 2 ────────────────────────────────────────────────────────────────
  { x: RCX - HS / 2,    y: RCY + VS     }, // slot  1              (189,149)
  { x: RCX + HS / 2,    y: RCY + VS     }, // slot  2              (211,149)

  // ── Row 3 — centre row ────────────────────────────────────────────────────
  { x: RCX - HS,        y: RCY          }, // slot  3              (178,130)
  { x: RCX,             y: RCY          }, // slot  4  8-ball here (200,130)
  { x: RCX + HS,        y: RCY          }, // slot  5              (222,130)

  // ── Row 4 ────────────────────────────────────────────────────────────────
  { x: RCX - HS * 1.5,  y: RCY - VS     }, // slot  6              (167,111)
  { x: RCX - HS / 2,    y: RCY - VS     }, // slot  7              (189,111)
  { x: RCX + HS / 2,    y: RCY - VS     }, // slot  8              (211,111)
  { x: RCX + HS * 1.5,  y: RCY - VS     }, // slot  9              (233,111)

  // ── Row 5 — back row (farthest from cue) ─────────────────────────────────
  { x: RCX - HS * 2,    y: RCY - VS * 2 }, // slot 10  back-left   (156, 92)
  { x: RCX - HS,        y: RCY - VS * 2 }, // slot 11              (178, 92)
  { x: RCX,             y: RCY - VS * 2 }, // slot 12              (200, 92)
  { x: RCX + HS,        y: RCY - VS * 2 }, // slot 13              (222, 92)
  { x: RCX + HS * 2,    y: RCY - VS * 2 }, // slot 14  back-right  (244, 92)
];

export const BALL_COUNT = 15;

// ─── HUD layout ───────────────────────────────────────────────────────────────
// Panel starts at TABLE.height + 10 px = 510.
// Available height: DESIGN_HEIGHT(750) − 510 = 240 px.
//
// Vertical stack:
//   +0   separator (2 px)
//   +3   balance row  (label 13 px + value 22 px ≈ 38 px total → ends ~551)
//   +41  outside bet row: LOW | ODD | EVEN | HIGH  (32 px → ends ~583)
//   +76  bet summary line (13 px → ends ~596)
//   +89  4×4 single-ball grid (4 × 24 px + 3 × 3 px = 105 px → ends ~705)
//   +198 action row: [−] [bet] [+] [BREAK]  (36 px → ends ~748)
//   +234 bottom (236 px < 240 ✓)
// ─── HUD layout ───────────────────────────────────────────────────────────────
// Panel starts at TABLE.height + 10 = 510.  Available: 750 − 510 = 240 px.
//
//   510  separator
//   513  BALANCE / WIN row                              (≈ 35 px)
//   548  "GROUP BETS" label                            ( 10 px)
//   558  [LOW] [ODD] [EVEN] [HIGH]   h=32             ( 32 px)
//   590  "SINGLE BALL" label                           ( 10 px)
//   600  4×4 ball grid  4×24 + 3×3                    (105 px → bottom 705)
//   709  [−] [$] [+] [BREAK]         h=36             ( 36 px → bottom 745)
export const HUD = {
  topY:          510,
  balanceY:      513,
  outsideBetsY:  558,   // top of outside-bet buttons (h=32 → bottom 590)
  summaryY:      590,   // "SINGLE BALL" label (used as section-label Y)
  gridY:         602,   // top of 4×4 ball grid (4×24+3×3=105 → bottom 707)
  actionRowY:    709,   // action row (h=36 → bottom 745 < 750 ✓)
} as const;

// ─── Animation timing (seconds unless noted) ────────────────────────────────
export const ANIM = {
  cueFadeIn:      0.25,
  cuePullback:    0.35,
  cueStrike:      0.18,
  cueBallTravel:  0.22,
  impactPauseMs:  60,
  scatterStart:   0.80,
  firstPocketMin: 2.20,   // increased for taller portrait table
  firstPocketMax: 3.00,
  settleAfter:    0.85,
  resolveDelay:   0.30,
} as const;

/**
 * Hud — premium mobile betting panel.
 *
 * Layout (from HUD.topY = 510):
 *   [BALANCE left  |  WIN right]         balanceY   514
 *   ─── GROUP BETS ───                              562
 *   [LOW] [ODD] [EVEN] [HIGH]            outsideBetsY 580  h=44
 *   ─── SINGLE BALL ───                  summaryY   634
 *   [5 × 3 ball grid, balls 1–15]        gridY      651  h=120
 *   [−] [stake] [+]  [BREAK]            actionRowY 781  h=44
 */

import { Container, Graphics, Text } from 'pixi.js';
import { BetController }  from '../controllers/BetController';
import { InputController } from '../controllers/InputController';
import { StateMachine }   from '../state/StateMachine';
import { GamePhase }      from '../state/GameState';
import { DESIGN_WIDTH, HUD } from '../config/gameConfig';
import { BET_OPTIONS, getBetDef, BetKey } from '../config/paytable';
import { getBallDef } from '../config/balls';
import { gsap } from 'gsap';

// ── Tile geometry ─────────────────────────────────────────────────────────────
// 5 columns × 3 rows = 15 tiles exactly, no empty cells.
const TILE_COLS  = 5;
const TILE_W     = 68;
const TILE_H     = 36;
const TILE_GAP   = 6;
const TILE_R     = 10;   // corner radius — rounder = more premium
const TILE_PAD_X = (DESIGN_WIDTH - TILE_COLS * TILE_W - (TILE_COLS - 1) * TILE_GAP) / 2; // 18

// Ball icon inside each tile
const ICON_R  = 9;    // mini ball radius
const ICON_X  = 16;   // icon centre-x
const ICON_Y  = 18;   // icon centre-y (= TILE_H / 2)
const NUM_X   = 47;   // number text centre-x

function displayToBetKey(n: number): BetKey {
  return `ball-${n}` as BetKey;
}

// Balls 1-15 grid starts below the cue-ball tile (gridY + TILE_H + 8px gap)
const BALLS_GRID_OFFSET = 44; // TILE_H(36) + gap(8)

// ── Outside bets ──────────────────────────────────────────────────────────────
const OUTSIDE: Array<{ key: BetKey; label: string; sublabel: string }> = [
  { key: 'low',  label: 'LOW',  sublabel: '1–7'    },
  { key: 'odd',  label: 'ODD',  sublabel: '1,3,5…' },
  { key: 'even', label: 'EVEN', sublabel: '2,4,6…' },
  { key: 'high', label: 'HIGH', sublabel: '9–15'   },
];
const OUTSIDE_BTN_H = 44;
const OUTSIDE_GAP   = 8;
const OUTSIDE_R     = 12;
const OUTSIDE_BTN_W = (DESIGN_WIDTH - 2 * 10 - (OUTSIDE.length - 1) * OUTSIDE_GAP) / OUTSIDE.length; // 89

// ── Action row ────────────────────────────────────────────────────────────────
const ACT_H     = 44;
const ACT_BTN   = 46;
const ACT_BET   = 90;
const ACT_PAD   = 10;
const ACT_GAP   = 6;   // gap between adj-btn, bet-display, and BREAK

// ── Colours ───────────────────────────────────────────────────────────────────
const SEL_GOLD       = 0xffd700;
const SEL_TILE_BG    = 0x0d3318;
const SEL_OUTSIDE_BG = 0x1c4228;
const TILE_BG        = 0x252525;
const CARD_BG        = 0x1e1e1e;   // slightly different for outside bets
const BTN_BG         = 0x1c1c1c;
const SECTION_COL    = 0x484848;
const LINE_COL       = 0x2c2c2c;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Draws a glossy raised card with optional top-left specular and bottom shadow. */
function drawCard(
  g: Graphics,
  x: number, y: number, w: number, h: number, r: number,
  fill: number,
  borderColor: number, borderAlpha: number, borderWidth: number,
): void {
  // Base fill
  g.roundRect(x, y, w, h, r);
  g.fill(fill);
  // Top-edge specular strip (inner highlight)
  g.roundRect(x + 1, y + 1, w - 2, Math.round(h * 0.42), r - 1);
  g.fill({ color: 0xffffff, alpha: 0.045 });
  // Bottom-edge shadow strip
  g.roundRect(x + 1, y + h - 5, w - 2, 4, 2);
  g.fill({ color: 0x000000, alpha: 0.18 });
  // Border
  g.roundRect(x, y, w, h, r);
  g.stroke({ color: borderColor, width: borderWidth, alpha: borderAlpha });
}

export class Hud extends Container {
  private balanceText!: Text;
  private winText!:     Text;
  private betDisplay!:  Text;
  private breakBg!:     Graphics;
  private breakLabel!:  Text;

  private tileBgs:           Map<string, Graphics> = new Map();
  private outsideBgs:        Map<string, Graphics> = new Map();
  private outsideMainLabels: Map<string, Text>     = new Map();

  private onBetSelect: (key: string) => void    = () => {};
  private onBreak:     () => void               = () => {};
  private onBetChange: (amount: number) => void = () => {};

  constructor(
    private sm:    StateMachine,
    private bet:   BetController,
    private input: InputController,
  ) {
    super();
    this.buildBackground();
    this.buildBalanceRow();
    this.buildSectionLabel('GROUP BETS', HUD.outsideBetsY - 18);
    this.buildOutsideBets();
    this.buildSectionLabel('SINGLE BALL', HUD.summaryY);
    this.buildGrid();
    this.buildActionRow();
  }

  // ─── Builders ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = new Graphics();
    // Panel background — fill generously past design height so no gap shows
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 400);
    bg.fill(0x0d0d0d);
    // Top separator line — fine metallic rule
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 1);
    bg.fill(0x333333);
    bg.rect(0, HUD.topY + 1, DESIGN_WIDTH, 1);
    bg.fill(0x1a1a1a);
    this.addChild(bg);
  }

  /** Section divider: thin lines flanking the centred label. */
  private buildSectionLabel(text: string, y: number): void {
    const cx      = DESIGN_WIDTH / 2;
    const lineY   = y + 5;
    const pad     = 10;
    const txtHalf = 46; // approx half of text + small clearance

    const lines = new Graphics();
    lines.moveTo(pad, lineY);
    lines.lineTo(cx - txtHalf, lineY);
    lines.moveTo(cx + txtHalf, lineY);
    lines.lineTo(DESIGN_WIDTH - pad, lineY);
    lines.stroke({ color: LINE_COL, width: 1 });
    this.addChild(lines);

    const lbl = new Text({
      text,
      style: {
        fontSize:      9,
        fill:          SECTION_COL,
        fontFamily:    'Arial',
        letterSpacing: 3,
      },
    });
    lbl.anchor.set(0.5, 0);
    lbl.x = cx;
    lbl.y = y;
    this.addChild(lbl);
  }

  private buildBalanceRow(): void {
    const y = HUD.balanceY;

    const balLabel = new Text({
      text: 'BALANCE',
      style: { fontSize: 9, fill: 0x555555, fontFamily: 'Arial', letterSpacing: 2 },
    });
    balLabel.x = 14;
    balLabel.y = y;
    this.addChild(balLabel);

    this.balanceText = new Text({
      text: '$1,000',
      style: { fontSize: 18, fill: 0xf0ece0, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.balanceText.x = 14;
    this.balanceText.y = y + 12;
    this.addChild(this.balanceText);

    const winLabel = new Text({
      text: 'WIN',
      style: { fontSize: 9, fill: 0x555555, fontFamily: 'Arial', letterSpacing: 2 },
    });
    winLabel.anchor.x = 1;
    winLabel.x = DESIGN_WIDTH - 14;
    winLabel.y = y;
    this.addChild(winLabel);

    this.winText = new Text({
      text: '',
      style: { fontSize: 18, fill: SEL_GOLD, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.winText.anchor.x = 1;
    this.winText.x = DESIGN_WIDTH - 14;
    this.winText.y = y + 12;
    this.addChild(this.winText);
  }

  private buildOutsideBets(): void {
    OUTSIDE.forEach(({ key, label, sublabel }, i) => {
      const x = 10 + i * (OUTSIDE_BTN_W + OUTSIDE_GAP);
      const y = HUD.outsideBetsY;

      const bg = new Graphics();
      this.drawOutsideBg(bg, false);
      bg.x = x;
      bg.y = y;
      bg.eventMode = 'static';
      bg.cursor    = 'pointer';
      bg.on('pointerdown', () => this.handleBetClick(key));
      this.addChild(bg);
      this.outsideBgs.set(key, bg);

      const mainTxt = new Text({
        text:  label,
        style: { fontSize: 15, fontWeight: 'bold', fill: 0xb0b0b0, fontFamily: 'Arial' },
      });
      mainTxt.anchor.set(0.5);
      mainTxt.x = x + OUTSIDE_BTN_W / 2;
      mainTxt.y = y + OUTSIDE_BTN_H / 2 - 8;
      this.addChild(mainTxt);
      this.outsideMainLabels.set(key, mainTxt);

      const subTxt = new Text({
        text:  sublabel,
        style: { fontSize: 9, fill: 0x545454, fontFamily: 'Arial' },
      });
      subTxt.anchor.set(0.5, 0);
      subTxt.x = x + OUTSIDE_BTN_W / 2;
      subTxt.y = y + OUTSIDE_BTN_H / 2 + 4;
      this.addChild(subTxt);
    });
  }

  private drawOutsideBg(g: Graphics, selected: boolean): void {
    g.clear();
    const W = OUTSIDE_BTN_W;
    const H = OUTSIDE_BTN_H;
    const R = OUTSIDE_R;

    if (selected) {
      // Wide soft glow halo
      g.roundRect(-4, -4, W + 8, H + 8, R + 4);
      g.fill({ color: SEL_GOLD, alpha: 0.18 });
      // Tinted green interior
      drawCard(g, 0, 0, W, H, R, SEL_OUTSIDE_BG, SEL_GOLD, 1, 2);
    } else {
      drawCard(g, 0, 0, W, H, R, CARD_BG, 0x383838, 1, 1);
    }
  }

  private buildGrid(): void {
    // ── Cue ball (zero) tile — centered above the main grid ──────────────────
    const cueKey = displayToBetKey(0);
    const cueTX  = DESIGN_WIDTH / 2 - TILE_W / 2;
    const cueTY  = HUD.gridY;

    const cueBg = new Graphics();
    this.drawTileBg(cueBg, 0, false);
    cueBg.x = cueTX;
    cueBg.y = cueTY;
    cueBg.eventMode = 'static';
    cueBg.cursor    = 'pointer';
    cueBg.on('pointerdown', () => this.handleBetClick(cueKey));
    this.addChild(cueBg);
    this.tileBgs.set(cueKey, cueBg);

    const cueNumTxt = new Text({
      text: '0',
      style: { fontSize: 15, fontWeight: 'bold', fill: 0xc8c8c8, fontFamily: 'Arial' },
    });
    cueNumTxt.anchor.set(0.5);
    cueNumTxt.x = cueTX + NUM_X;
    cueNumTxt.y = cueTY + ICON_Y;
    this.addChild(cueNumTxt);

    // ── Balls 1–15 — 5 × 3 grid below cue tile ───────────────────────────────
    const ballsGridY = HUD.gridY + BALLS_GRID_OFFSET;
    for (let n = 1; n <= 15; n++) {
      const slot = n - 1;
      const col  = slot % TILE_COLS;
      const row  = Math.floor(slot / TILE_COLS);
      const tx   = TILE_PAD_X + col * (TILE_W + TILE_GAP);
      const ty   = ballsGridY  + row * (TILE_H + TILE_GAP);
      const key  = displayToBetKey(n);

      const bg = new Graphics();
      this.drawTileBg(bg, n, false);
      bg.x = tx;
      bg.y = ty;
      bg.eventMode = 'static';
      bg.cursor    = 'pointer';
      bg.on('pointerdown', () => this.handleBetClick(key));
      this.addChild(bg);
      this.tileBgs.set(key, bg);

      // Number label — right portion of tile, always light gray
      const numTxt = new Text({
        text: String(n),
        style: {
          fontSize:   n >= 10 ? 13 : 15,
          fontWeight: 'bold',
          fill:       0xc8c8c8,
          fontFamily: 'Arial',
        },
      });
      numTxt.anchor.set(0.5);
      numTxt.x = tx + NUM_X;
      numTxt.y = ty + ICON_Y;
      this.addChild(numTxt);
    }
  }

  private drawTileBg(g: Graphics, n: number, selected: boolean): void {
    g.clear();
    const W = TILE_W;
    const H = TILE_H;
    const R = TILE_R;

    if (selected) {
      // Outer glow halo
      g.roundRect(-4, -4, W + 8, H + 8, R + 4);
      g.fill({ color: SEL_GOLD, alpha: 0.22 });
      // Green tinted card
      drawCard(g, 0, 0, W, H, R, SEL_TILE_BG, SEL_GOLD, 1, 2.5);
      // Extra inner rim glow
      g.roundRect(2, 2, W - 4, H - 4, R - 2);
      g.stroke({ color: SEL_GOLD, width: 0.5, alpha: 0.3 });
    } else {
      drawCard(g, 0, 0, W, H, R, TILE_BG, 0x343434, 1, 1);
    }

    // ── Mini pool-ball icon ───────────────────────────────────────────────────
    const ix = ICON_X;
    const iy = ICON_Y;
    const ir = ICON_R;
    const ballDef = getBallDef(n);
    const col     = ballDef?.color ?? 0x888888;

    if (n === 0) {
      // Cue ball: plain white sphere with specular
      g.circle(ix, iy, ir);
      g.fill(0xf5f0e0);
      g.circle(ix, iy, ir);
      g.stroke({ color: 0xaaaaaa, width: 0.8, alpha: 0.6 });
      g.ellipse(ix - ir * 0.28, iy - ir * 0.32, ir * 0.35, ir * 0.22);
      g.fill({ color: 0xffffff, alpha: 0.7 });
    } else if (n === 8) {
      // 8-ball: black sphere, white number circle, specular
      g.circle(ix, iy, ir);
      g.fill(0x111111);
      g.circle(ix, iy, ir);
      g.stroke({ color: 0x444444, width: 0.8 });
      g.circle(ix, iy, ir * 0.42);
      g.fill(0xffffff);
      g.ellipse(ix - ir * 0.28, iy - ir * 0.32, ir * 0.3, ir * 0.18);
      g.fill({ color: 0xffffff, alpha: 0.28 });
    } else if (n >= 9) {
      // Stripe: white sphere with colored caps top and bottom
      const capR = Math.round(ir * 0.62);
      g.circle(ix, iy, ir);
      g.fill(0xffffff);
      g.circle(ix, iy - ir + capR, capR);
      g.fill(col);
      g.circle(ix, iy + ir - capR, capR);
      g.fill(col);
      // Outline
      g.circle(ix, iy, ir);
      g.stroke({ color: col, width: 1.2, alpha: 0.75 });
      // Specular
      g.ellipse(ix - ir * 0.26, iy - ir * 0.3, ir * 0.28, ir * 0.17);
      g.fill({ color: 0xffffff, alpha: 0.55 });
    } else {
      // Solid 1–7: colored sphere, white number disc, specular
      g.circle(ix, iy, ir);
      g.fill(col);
      g.circle(ix, iy, ir);
      g.stroke({ color: 0x000000, width: 0.8, alpha: 0.4 });
      // Specular
      g.ellipse(ix - ir * 0.28, iy - ir * 0.32, ir * 0.35, ir * 0.22);
      g.fill({ color: 0xffffff, alpha: 0.5 });
      // White number disc (like a real pool ball)
      g.circle(ix, iy, ir * 0.42);
      g.fill(0xffffff);
    }
  }

  private buildActionRow(): void {
    const y  = HUD.actionRowY;

    // ── [−] button ────────────────────────────────────────────────────────────
    const minusBg = new Graphics();
    this.drawAdjBtn(minusBg);
    minusBg.x = ACT_PAD;
    minusBg.y = y;
    minusBg.eventMode = 'static';
    minusBg.cursor    = 'pointer';
    minusBg.on('pointerdown', () => this.shiftBet(-1));
    this.addChild(minusBg);

    new Text({ text: '−', style: { fontSize: 22, fill: 0x999999, fontFamily: 'Arial', fontWeight: 'bold' } });
    const minusTxt = new Text({
      text: '−',
      style: { fontSize: 22, fill: 0x9a9a9a, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    minusTxt.anchor.set(0.5);
    minusTxt.x = ACT_PAD + ACT_BTN / 2;
    minusTxt.y = y + ACT_H / 2 + 1;
    this.addChild(minusTxt);

    // ── Bet display ───────────────────────────────────────────────────────────
    const betX = ACT_PAD + ACT_BTN + ACT_GAP;
    const betBg = new Graphics();
    drawCard(betBg, betX, y, ACT_BET, ACT_H, 8, 0x181818, 0x303030, 1, 1);
    this.addChild(betBg);

    this.betDisplay = new Text({
      text: `$${this.bet.currentBet}`,
      style: { fontSize: 16, fontWeight: 'bold', fill: 0xf0ece0, fontFamily: 'Arial' },
    });
    this.betDisplay.anchor.set(0.5);
    this.betDisplay.x = betX + ACT_BET / 2;
    this.betDisplay.y = y + ACT_H / 2;
    this.addChild(this.betDisplay);

    // ── [+] button ────────────────────────────────────────────────────────────
    const plusX = betX + ACT_BET + ACT_GAP;
    const plusBg = new Graphics();
    this.drawAdjBtn(plusBg);
    plusBg.x = plusX;
    plusBg.y = y;
    plusBg.eventMode = 'static';
    plusBg.cursor    = 'pointer';
    plusBg.on('pointerdown', () => this.shiftBet(+1));
    this.addChild(plusBg);

    const plusTxt = new Text({
      text: '+',
      style: { fontSize: 22, fill: 0x9a9a9a, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    plusTxt.anchor.set(0.5);
    plusTxt.x = plusX + ACT_BTN / 2;
    plusTxt.y = y + ACT_H / 2 + 1;
    this.addChild(plusTxt);

    // ── BREAK button ──────────────────────────────────────────────────────────
    const breakX = plusX + ACT_BTN + ACT_PAD;
    const breakW = DESIGN_WIDTH - breakX - ACT_PAD;
    const breakCont = new Container();
    breakCont.x = breakX;
    breakCont.y = y;

    this.breakBg = new Graphics();
    this.drawBreakBtn(false, breakW);
    breakCont.addChild(this.breakBg);

    this.breakLabel = new Text({
      text: 'BREAK',
      style: {
        fontSize:      17,
        fontWeight:    'bold',
        fill:          0xffffff,
        fontFamily:    'Arial',
        letterSpacing: 3,
      },
    });
    this.breakLabel.anchor.set(0.5);
    this.breakLabel.x = breakW / 2;
    this.breakLabel.y = ACT_H / 2;
    breakCont.addChild(this.breakLabel);

    breakCont.eventMode = 'static';
    breakCont.cursor    = 'pointer';
    breakCont.on('pointerdown', () => {
      if (this.input.isLocked()) return;
      if (!this.sm.canStartRound()) return;
      // Micro press-in animation
      gsap.to(breakCont.scale, { x: 0.96, y: 0.96, duration: 0.07, ease: 'power2.out',
        onComplete: () => { gsap.to(breakCont.scale, { x: 1, y: 1, duration: 0.14, ease: 'back.out(2)' }); } });
      this.onBreak();
    });
    this.addChild(breakCont);

    (this.breakBg as any)._breakW = breakW;
  }

  private drawAdjBtn(g: Graphics): void {
    g.clear();
    drawCard(g, 0, 0, ACT_BTN, ACT_H, 9, BTN_BG, 0x363636, 1, 1);
  }

  private drawBreakBtn(active: boolean, w: number): void {
    this.breakBg.clear();
    if (active) {
      // Outer soft glow
      this.breakBg.roundRect(-5, -5, w + 10, ACT_H + 10, 14);
      this.breakBg.fill({ color: 0x33ff88, alpha: 0.13 });
      // Dark green base
      this.breakBg.roundRect(0, 0, w, ACT_H, 10);
      this.breakBg.fill(0x1a6b3c);
      // Lighter green mid-layer
      this.breakBg.roundRect(1, 1, w - 2, ACT_H - 2, 9);
      this.breakBg.fill(0x24a055);
      // Top gloss strip
      this.breakBg.roundRect(3, 3, w - 6, Math.round(ACT_H * 0.44), 7);
      this.breakBg.fill({ color: 0xffffff, alpha: 0.13 });
      // Bottom shadow strip
      this.breakBg.roundRect(2, ACT_H - 6, w - 4, 5, 4);
      this.breakBg.fill({ color: 0x000000, alpha: 0.2 });
      // Bright top edge (rim light)
      this.breakBg.roundRect(0, 0, w, ACT_H, 10);
      this.breakBg.stroke({ color: 0x50ff99, width: 1.5, alpha: 0.45 });
    } else {
      drawCard(this.breakBg, 0, 0, w, ACT_H, 10, BTN_BG, 0x303030, 1, 1);
    }
  }

  // ─── Interaction ─────────────────────────────────────────────────────────────

  private handleBetClick(key: BetKey): void {
    if (this.input.isLocked()) return;
    if (this.sm.current !== GamePhase.BETTING) return;
    // Update state BEFORE selectBet so refreshBreakButton sees the new key.
    this.onBetSelect(key);
    this.selectBet(key);
  }

  private shiftBet(delta: number): void {
    if (this.input.isLocked()) return;
    if (!this.bet.canChangeBet()) return;
    const idx    = BET_OPTIONS.indexOf(this.bet.currentBet as any);
    const newIdx = Math.max(0, Math.min(BET_OPTIONS.length - 1, idx + delta));
    const amount = BET_OPTIONS[newIdx];
    if (amount === this.bet.currentBet) return;
    this.onBetChange(amount);
    this.betDisplay.text = `$${amount}`;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  setOnBetSelect(fn: (key: string) => void): void  { this.onBetSelect = fn; }
  setOnBreak(fn: () => void): void                 { this.onBreak = fn; }
  setOnBetChange(fn: (a: number) => void): void    { this.onBetChange = fn; }

  selectBet(key: string): void {
    for (const { key: k } of OUTSIDE) {
      const bg  = this.outsideBgs.get(k);
      const lbl = this.outsideMainLabels.get(k);
      if (bg)  this.drawOutsideBg(bg, k === key);
      if (lbl) lbl.style.fill = k === key ? SEL_GOLD : 0xb0b0b0;
    }
    for (let n = 1; n <= 15; n++) {
      const k  = displayToBetKey(n);
      const bg = this.tileBgs.get(k);
      if (bg) this.drawTileBg(bg, n, k === key);
    }
    this.refreshBreakButton();
  }

  deselectAll(): void {
    for (const { key } of OUTSIDE) {
      const bg  = this.outsideBgs.get(key);
      const lbl = this.outsideMainLabels.get(key);
      if (bg)  this.drawOutsideBg(bg, false);
      if (lbl) lbl.style.fill = 0xb0b0b0;
    }
    for (let n = 1; n <= 15; n++) {
      const bg = this.tileBgs.get(displayToBetKey(n));
      if (bg) this.drawTileBg(bg, n, false);
    }
    this.refreshBreakButton();
  }

  refreshBreakButton(): void {
    const active = this.sm.canStartRound();
    const w      = (this.breakBg as any)._breakW ?? 180;
    this.drawBreakBtn(active, w);
  }

  updateBalance(): void {
    this.balanceText.text = `$${this.bet.balance.toLocaleString()}`;
    this.betDisplay.text  = `$${this.bet.currentBet}`;
  }

  showWin(amount: number): void {
    this.winText.text = `+$${amount.toLocaleString()}`;
    gsap.fromTo(this.winText.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)' });
  }

  clearWin(): void {
    this.winText.text = '';
  }

  setLocked(locked: boolean): void {
    const alpha = locked ? 0.4 : 1;
    this.tileBgs.forEach(bg    => { bg.alpha = alpha; });
    this.outsideBgs.forEach(bg => { bg.alpha = alpha; });
  }

  resetForNewRound(): void {
    this.deselectAll();
    this.clearWin();
    this.updateBalance();
    this.setLocked(false);
    this.refreshBreakButton();
  }

  /** @deprecated kept for compatibility */
  updateBetHighlight(_current: number): void {
    this.betDisplay.text = `$${this.bet.currentBet}`;
  }
}

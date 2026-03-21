/**
 * Hud — premium mobile betting panel.
 *
 * Layout (from HUD.topY):
 *   [BALANCE left  |  WIN right]       balanceY
 *   [GROUP BETS header]
 *   [LOW] [ODD] [EVEN] [HIGH]          outsideBetsY
 *   [SINGLE BALL header]               summaryY
 *   [4×4 ball grid, n=0..15]           gridY        (tiles 88×24 px)
 *   [−] [stake] [+] [BREAK]            actionRowY
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
const TILE_COLS  = 4;
const TILE_W     = 88;
const TILE_H     = 24;
const TILE_GAP   = 3;
const TILE_PAD_X = (DESIGN_WIDTH - TILE_COLS * TILE_W - (TILE_COLS - 1) * TILE_GAP) / 2;

// Ball icon inside each tile
const ICON_R  = 7;    // circle radius
const ICON_X  = 15;   // icon centre-x relative to tile
const ICON_Y  = 12;   // icon centre-y relative to tile (= TILE_H / 2)
const NUM_X   = 55;   // number text centre-x relative to tile

function displayToBetKey(n: number): BetKey {
  return n === 0 ? 'cue' : (`ball-${n}` as BetKey);
}

// ── Outside bets ──────────────────────────────────────────────────────────────
const OUTSIDE: Array<{ key: BetKey; label: string; sublabel: string }> = [
  { key: 'low',  label: 'LOW',  sublabel: '1–8'     },
  { key: 'odd',  label: 'ODD',  sublabel: '1,3,5…'  },
  { key: 'even', label: 'EVEN', sublabel: '2,4,6…'  },
  { key: 'high', label: 'HIGH', sublabel: '8–15'    },
];
const OUTSIDE_BTN_H = 32;
const OUTSIDE_GAP   = 6;
const OUTSIDE_BTN_W = (DESIGN_WIDTH - 2 * 8 - (OUTSIDE.length - 1) * OUTSIDE_GAP) / OUTSIDE.length;

// ── Action row ────────────────────────────────────────────────────────────────
const ACT_H   = 36;
const ACT_BTN = 40;
const ACT_BET = 80;
const ACT_PAD = 8;

// ── Colours ───────────────────────────────────────────────────────────────────
const SEL_BORDER     = 0xffd700;
const SEL_TILE_BG    = 0x0a2c14;
const SEL_OUTSIDE_BG = 0x1a3a22;
const DARK_TILE_BG   = 0x1c1c1c;
const DARK_BTN_BG    = 0x1a1a1a;
const CUE_CIRCLE_COL = 0xf5f0e0;
const SECTION_LABEL  = 0x555555;

export class Hud extends Container {
  private balanceText!: Text;
  private winText!:     Text;
  private betDisplay!:  Text;
  private breakBg!:     Graphics;
  private breakLabel!:  Text;

  private tileBgs:    Map<string, Graphics> = new Map();
  private outsideBgs: Map<string, Graphics> = new Map();
  // Track label texts so we can recolour them on select
  private outsideMainLabels: Map<string, Text> = new Map();

  private onBetSelect: (key: string) => void = () => {};
  private onBreak:     () => void            = () => {};
  private onBetChange: (amount: number) => void = () => {};

  constructor(
    private sm:    StateMachine,
    private bet:   BetController,
    private input: InputController,
  ) {
    super();
    this.buildBackground();
    this.buildBalanceRow();
    this.buildSectionLabel('GROUP BETS', HUD.outsideBetsY - 14);
    this.buildOutsideBets();
    this.buildSectionLabel('SINGLE BALL', HUD.summaryY);
    this.buildGrid();
    this.buildActionRow();
  }

  // ─── Builders ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = new Graphics();
    bg.rect(0, HUD.topY, DESIGN_WIDTH, DESIGN_WIDTH);   // generous overshoot
    bg.fill({ color: 0x0d0d0d });
    // separator line
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 2);
    bg.fill({ color: 0x2a2a2a });
    this.addChild(bg);
  }

  private buildSectionLabel(text: string, y: number): void {
    const lbl = new Text({
      text,
      style: { fontSize: 9, fill: SECTION_LABEL, fontFamily: 'Arial', letterSpacing: 2 },
    });
    lbl.anchor.set(0.5, 0);
    lbl.x = DESIGN_WIDTH / 2;
    lbl.y = y;
    this.addChild(lbl);
  }

  private buildBalanceRow(): void {
    const balLabel = new Text({
      text: 'BALANCE',
      style: { fontSize: 9, fill: 0x666666, fontFamily: 'Arial', letterSpacing: 2 },
    });
    balLabel.x = 14;
    balLabel.y = HUD.balanceY;
    this.addChild(balLabel);

    this.balanceText = new Text({
      text: '$1,000',
      style: { fontSize: 17, fill: 0xf5f0e0, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.balanceText.x = 14;
    this.balanceText.y = HUD.balanceY + 12;
    this.addChild(this.balanceText);

    const winLabel = new Text({
      text: 'WIN',
      style: { fontSize: 9, fill: 0x666666, fontFamily: 'Arial', letterSpacing: 2 },
    });
    winLabel.anchor.x = 1;
    winLabel.x = DESIGN_WIDTH - 14;
    winLabel.y = HUD.balanceY;
    this.addChild(winLabel);

    this.winText = new Text({
      text: '',
      style: { fontSize: 17, fill: 0xffd700, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.winText.anchor.x = 1;
    this.winText.x = DESIGN_WIDTH - 14;
    this.winText.y = HUD.balanceY + 12;
    this.addChild(this.winText);
  }

  private buildOutsideBets(): void {
    OUTSIDE.forEach(({ key, label, sublabel }, i) => {
      const x = 8 + i * (OUTSIDE_BTN_W + OUTSIDE_GAP);
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
        text: label,
        style: { fontSize: 13, fontWeight: 'bold', fill: 0xbbbbbb, fontFamily: 'Arial' },
      });
      mainTxt.anchor.set(0.5);
      mainTxt.x = x + OUTSIDE_BTN_W / 2;
      mainTxt.y = y + OUTSIDE_BTN_H / 2 - 6;
      this.addChild(mainTxt);
      this.outsideMainLabels.set(key, mainTxt);

      const subTxt = new Text({
        text: sublabel,
        style: { fontSize: 8, fill: 0x666666, fontFamily: 'Arial' },
      });
      subTxt.anchor.set(0.5, 0);
      subTxt.x = x + OUTSIDE_BTN_W / 2;
      subTxt.y = y + OUTSIDE_BTN_H / 2 + 2;
      this.addChild(subTxt);
    });
  }

  private drawOutsideBg(g: Graphics, selected: boolean): void {
    g.clear();
    if (selected) {
      // Gold glow halo
      g.roundRect(-2, -2, OUTSIDE_BTN_W + 4, OUTSIDE_BTN_H + 4, 8);
      g.fill({ color: SEL_BORDER, alpha: 0.18 });
      // Dark green interior
      g.roundRect(0, 0, OUTSIDE_BTN_W, OUTSIDE_BTN_H, 6);
      g.fill(SEL_OUTSIDE_BG);
      // Inner highlight strip
      g.roundRect(1, 1, OUTSIDE_BTN_W - 2, 10, 5);
      g.fill({ color: 0xffffff, alpha: 0.04 });
      // Gold border
      g.roundRect(0, 0, OUTSIDE_BTN_W, OUTSIDE_BTN_H, 6);
      g.stroke({ color: SEL_BORDER, width: 1.5 });
    } else {
      g.roundRect(0, 0, OUTSIDE_BTN_W, OUTSIDE_BTN_H, 6);
      g.fill(DARK_TILE_BG);
      g.roundRect(1, 1, OUTSIDE_BTN_W - 2, OUTSIDE_BTN_H / 2, 5);
      g.fill({ color: 0xffffff, alpha: 0.03 });
      g.roundRect(0, 0, OUTSIDE_BTN_W, OUTSIDE_BTN_H, 6);
      g.stroke({ color: 0x333333, width: 1 });
    }
  }

  private buildGrid(): void {
    for (let n = 0; n <= 15; n++) {
      const col = n % TILE_COLS;
      const row = Math.floor(n / TILE_COLS);
      const tx  = TILE_PAD_X + col * (TILE_W + TILE_GAP);
      const ty  = HUD.gridY  + row * (TILE_H + TILE_GAP);
      const key = displayToBetKey(n);

      const bg = new Graphics();
      this.drawTileBg(bg, n, false);
      bg.x = tx;
      bg.y = ty;
      bg.eventMode = 'static';
      bg.cursor    = 'pointer';
      bg.on('pointerdown', () => this.handleBetClick(key));
      this.addChild(bg);
      this.tileBgs.set(key, bg);

      if (n === 0) {
        // CUE tile: centred label pair
        const numTxt = new Text({
          text: '0',
          style: { fontSize: 10, fontWeight: 'bold', fill: 0xbbbbbb, fontFamily: 'Arial' },
        });
        numTxt.anchor.set(0.5);
        numTxt.x = tx + NUM_X;
        numTxt.y = ty + ICON_Y - 4;
        this.addChild(numTxt);

        const cueTxt = new Text({
          text: 'CUE',
          style: { fontSize: 7, fill: 0x777777, fontFamily: 'Arial', letterSpacing: 1 },
        });
        cueTxt.anchor.set(0.5, 0);
        cueTxt.x = tx + NUM_X;
        cueTxt.y = ty + ICON_Y + 3;
        this.addChild(cueTxt);
      } else {
        const isStripe   = n >= 9;
        const textColor  = n === 8 ? 0xffffff
                         : isStripe ? 0x222222
                         : 0xffffff;
        const numTxt = new Text({
          text: String(n),
          style: {
            fontSize: n >= 10 ? 11 : 13,
            fontWeight: 'bold',
            fill: textColor,
            fontFamily: 'Arial',
          },
        });
        numTxt.anchor.set(0.5);
        numTxt.x = tx + NUM_X;
        numTxt.y = ty + ICON_Y;
        this.addChild(numTxt);
      }
    }
  }

  private drawTileBg(g: Graphics, n: number, selected: boolean): void {
    g.clear();

    // ── Background card ───────────────────────────────────────────────────────
    if (selected) {
      // Outer glow
      g.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, 6);
      g.fill({ color: SEL_BORDER, alpha: 0.22 });
      // Dark green bg
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.fill(SEL_TILE_BG);
      // Inner shine
      g.roundRect(1, 1, TILE_W - 2, 9, 3);
      g.fill({ color: 0xffffff, alpha: 0.05 });
      // Gold border
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.stroke({ color: SEL_BORDER, width: 2 });
    } else {
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.fill(DARK_TILE_BG);
      // Subtle top shine
      g.roundRect(1, 1, TILE_W - 2, 9, 3);
      g.fill({ color: 0xffffff, alpha: 0.03 });
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.stroke({ color: 0x2e2e2e, width: 1 });
    }

    // ── Ball icon ─────────────────────────────────────────────────────────────
    const ix = ICON_X;
    const iy = ICON_Y;
    const ir = ICON_R;

    if (n === 0) {
      // Cue ball — ivory circle with subtle ring
      g.circle(ix, iy, ir);
      g.fill(CUE_CIRCLE_COL);
      g.circle(ix, iy, ir);
      g.stroke({ color: 0xaaaaaa, width: 0.8 });
      // Tiny specular
      g.circle(ix - 2, iy - 2, 2);
      g.fill({ color: 0xffffff, alpha: 0.5 });
    } else if (n === 8) {
      // 8-ball — black with white dot
      g.circle(ix, iy, ir);
      g.fill(0x111111);
      g.circle(ix - 2, iy - 1, 2.5);
      g.fill(0xffffff);
    } else if (n >= 9) {
      // Stripe — white base + ball-colour caps for stripe effect
      const ballDef = getBallDef(n);
      const col     = ballDef?.color ?? 0x888888;
      const capR    = Math.round(ir * 0.55);
      g.circle(ix, iy, ir);
      g.fill(0xffffff);
      g.circle(ix, iy - ir + capR, capR);
      g.fill(col);
      g.circle(ix, iy + ir - capR, capR);
      g.fill(col);
      // Thin outline
      g.circle(ix, iy, ir);
      g.stroke({ color: col, width: 1 });
    } else {
      // Solid 1–7
      const ballDef = getBallDef(n);
      g.circle(ix, iy, ir);
      g.fill(ballDef?.color ?? 0x888888);
      // Specular
      g.circle(ix - 2, iy - 2, 2.5);
      g.fill({ color: 0xffffff, alpha: 0.35 });
    }
  }

  private buildActionRow(): void {
    const y  = HUD.actionRowY;

    // [−] button
    const minusBg = new Graphics();
    this.drawAdjBtn(minusBg);
    minusBg.x = ACT_PAD;
    minusBg.y = y;
    minusBg.eventMode = 'static';
    minusBg.cursor    = 'pointer';
    minusBg.on('pointerdown', () => this.shiftBet(-1));
    this.addChild(minusBg);

    const minusTxt = new Text({
      text: '−',
      style: { fontSize: 20, fill: 0xaaaaaa, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    minusTxt.anchor.set(0.5);
    minusTxt.x = ACT_PAD + ACT_BTN / 2;
    minusTxt.y = y + ACT_H / 2;
    this.addChild(minusTxt);

    // Bet display (plain text between [-] and [+])
    const betBg = new Graphics();
    betBg.roundRect(ACT_PAD + ACT_BTN + 4, y, ACT_BET, ACT_H, 4);
    betBg.fill(0x141414);
    betBg.roundRect(ACT_PAD + ACT_BTN + 4, y, ACT_BET, ACT_H, 4);
    betBg.stroke({ color: 0x2a2a2a, width: 1 });
    this.addChild(betBg);

    this.betDisplay = new Text({
      text: `$${this.bet.currentBet}`,
      style: { fontSize: 15, fontWeight: 'bold', fill: 0xf5f0e0, fontFamily: 'Arial' },
    });
    this.betDisplay.anchor.set(0.5);
    this.betDisplay.x = ACT_PAD + ACT_BTN + 4 + ACT_BET / 2;
    this.betDisplay.y = y + ACT_H / 2;
    this.addChild(this.betDisplay);

    // [+] button
    const plusBg = new Graphics();
    this.drawAdjBtn(plusBg);
    const plusX = ACT_PAD + ACT_BTN + 4 + ACT_BET + 4;
    plusBg.x = plusX;
    plusBg.y = y;
    plusBg.eventMode = 'static';
    plusBg.cursor    = 'pointer';
    plusBg.on('pointerdown', () => this.shiftBet(+1));
    this.addChild(plusBg);

    const plusTxt = new Text({
      text: '+',
      style: { fontSize: 18, fill: 0xaaaaaa, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    plusTxt.anchor.set(0.5);
    plusTxt.x = plusX + ACT_BTN / 2;
    plusTxt.y = y + ACT_H / 2;
    this.addChild(plusTxt);

    // BREAK button
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
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0xffffff,
        fontFamily: 'Arial',
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
      this.onBreak();
    });
    this.addChild(breakCont);

    (this.breakBg as any)._breakW = breakW;
  }

  private drawAdjBtn(g: Graphics): void {
    g.clear();
    g.roundRect(0, 0, ACT_BTN, ACT_H, 6);
    g.fill(DARK_TILE_BG);
    g.roundRect(0, 0, ACT_BTN, ACT_H, 6);
    g.stroke({ color: 0x333333, width: 1 });
  }

  private drawBreakBtn(active: boolean, w: number): void {
    this.breakBg.clear();
    if (active) {
      // Outer glow
      this.breakBg.roundRect(-3, -3, w + 6, ACT_H + 6, 10);
      this.breakBg.fill({ color: 0x33ff88, alpha: 0.12 });
      // Base
      this.breakBg.roundRect(0, 0, w, ACT_H, 8);
      this.breakBg.fill(0x1a6b3c);
      // Inner lighter layer
      this.breakBg.roundRect(1, 1, w - 2, ACT_H - 2, 7);
      this.breakBg.fill(0x27a85e);
      // Top shine
      this.breakBg.roundRect(3, 3, w - 6, Math.round(ACT_H * 0.38), 5);
      this.breakBg.fill({ color: 0xffffff, alpha: 0.12 });
    } else {
      this.breakBg.roundRect(0, 0, w, ACT_H, 8);
      this.breakBg.fill(DARK_BTN_BG);
      this.breakBg.roundRect(1, 1, w - 2, ACT_H - 2, 7);
      this.breakBg.fill(0x242424);
    }
  }

  // ─── Interaction ─────────────────────────────────────────────────────────────

  private handleBetClick(key: BetKey): void {
    if (this.input.isLocked()) return;
    if (this.sm.current !== GamePhase.BETTING) return;
    // IMPORTANT: update state BEFORE selectBet, so refreshBreakButton sees the new key.
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
      if (lbl) lbl.style.fill = k === key ? SEL_BORDER : 0xbbbbbb;
    }
    for (let n = 0; n <= 15; n++) {
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
      if (lbl) lbl.style.fill = 0xbbbbbb;
    }
    for (let n = 0; n <= 15; n++) {
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

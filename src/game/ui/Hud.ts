/**
 * Hud — mobile-first betting panel.
 *
 * Layout (Y from DESIGN_HEIGHT top):
 *   [balance row]                  balanceY
 *   [LOW] [ODD] [EVEN] [HIGH]     outsideBetsY  (36 px tall each)
 *   [summary: bet label × mult → $X]  summaryY
 *   [4×4 single-ball grid 0–15]   gridY         (tiles 30×88 px, 3 px gaps)
 *   [−] [bet amount] [+] [BREAK]  actionRowY    (42 px tall)
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
const TILE_ROWS  = 4;           // rows 0–3
const TILE_W     = 88;          // px
const TILE_H     = 24;          // px  (compact for 240 px HUD budget)
const TILE_GAP   = 3;           // px between tiles
const TILE_PAD_X = (DESIGN_WIDTH - TILE_COLS * TILE_W - (TILE_COLS - 1) * TILE_GAP) / 2;

// Tiles represent display numbers 0–15:
//   0 → cue ball ('cue' bet), displayed as "0" + "CUE"
//   1–15 → ball-N bets

function displayToBetKey(n: number): BetKey {
  return n === 0 ? 'cue' : (`ball-${n}` as BetKey);
}

// ── Outside bets ──────────────────────────────────────────────────────────────
const OUTSIDE: Array<{ key: BetKey; label: string; sublabel: string }> = [
  { key: 'low',  label: 'LOW',  sublabel: '1–8'  },
  { key: 'odd',  label: 'ODD',  sublabel: ''      },
  { key: 'even', label: 'EVEN', sublabel: ''      },
  { key: 'high', label: 'HIGH', sublabel: '8–15' },
];

const OUTSIDE_BTN_H  = 32;
const OUTSIDE_GAP    = 8;
const OUTSIDE_BTN_W  = (DESIGN_WIDTH - 2 * 8 - (OUTSIDE.length - 1) * OUTSIDE_GAP) / OUTSIDE.length; // ≈ 90

// ── Action row ────────────────────────────────────────────────────────────────
const ACT_H    = 36;            // action-row height
const ACT_BTN  = 40;            // [-] / [+] button width
const ACT_BET  = 80;            // bet display width
const ACT_PAD  = 8;             // side padding
// BREAK button x = ACT_PAD + ACT_BTN + ACT_PAD + ACT_BET + ACT_PAD + ACT_BTN + ACT_PAD = 8+40+8+82+8+40+8=194
// BREAK width = DESIGN_WIDTH − 194 − ACT_PAD = 400 − 194 − 8 = 198

// ── Color utilities ───────────────────────────────────────────────────────────
const CUE_FILL    = 0xf5f0e0;
const TILE_SEL_BG = 0x1a4820;   // selected tile dark-green bg tint
const SEL_BORDER  = 0xffd700;   // gold selection ring
const OUTSIDE_SEL = 0x1e6b3c;   // selected outside btn bg

export class Hud extends Container {
  private balanceText!:  Text;
  private winText!:      Text;
  private summaryText!:  Text;
  private betDisplay!:   Text;
  private breakBg!:      Graphics;
  private breakLabel!:   Text;

  // tile and outside-bet graphics (key → bg Graphics for redraw)
  private tileBgs:      Map<string, Graphics> = new Map();
  private outsideBgs:   Map<string, Graphics> = new Map();

  private onBetSelect:  (key: string) => void = () => {};
  private onBreak:      () => void             = () => {};
  private onBetChange:  (amount: number) => void = () => {};

  constructor(
    private sm:    StateMachine,
    private bet:   BetController,
    private input: InputController,
  ) {
    super();
    this.buildBackground();
    this.buildBalanceRow();
    this.buildOutsideBets();
    this.buildSummary();
    this.buildGrid();
    this.buildActionRow();
  }

  // ─── Builders ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = new Graphics();
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 300);
    bg.fill({ color: 0x0d0d0d, alpha: 1 });
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 2);
    bg.fill({ color: 0x2a2a2a });
    this.addChild(bg);
  }

  private buildBalanceRow(): void {
    const balLabel = new Text({
      text: 'BALANCE',
      style: { fontSize: 10, fill: 0x777777, fontFamily: 'Arial', letterSpacing: 2 },
    });
    balLabel.x = 14;
    balLabel.y = HUD.balanceY;
    this.addChild(balLabel);

    this.balanceText = new Text({
      text: '$1,000',
      style: { fontSize: 18, fill: 0xf5f0e0, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.balanceText.x = 14;
    this.balanceText.y = HUD.balanceY + 13;
    this.addChild(this.balanceText);

    const winLabel = new Text({
      text: 'WIN',
      style: { fontSize: 10, fill: 0x777777, fontFamily: 'Arial', letterSpacing: 2 },
    });
    winLabel.anchor.x = 1;
    winLabel.x = DESIGN_WIDTH - 14;
    winLabel.y = HUD.balanceY;
    this.addChild(winLabel);

    this.winText = new Text({
      text: '',
      style: { fontSize: 18, fill: 0xffd700, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.winText.anchor.x = 1;
    this.winText.x = DESIGN_WIDTH - 14;
    this.winText.y = HUD.balanceY + 13;
    this.addChild(this.winText);
  }

  private buildOutsideBets(): void {
    OUTSIDE.forEach(({ key, label, sublabel }, i) => {
      const x  = 8 + i * (OUTSIDE_BTN_W + OUTSIDE_GAP);
      const y  = HUD.outsideBetsY;

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
        style: { fontSize: 13, fontWeight: 'bold', fill: 0xdddddd, fontFamily: 'Arial', letterSpacing: 1 },
      });
      mainTxt.anchor.set(0.5, sublabel ? 0.6 : 0.5);
      mainTxt.x = x + OUTSIDE_BTN_W / 2;
      mainTxt.y = y + OUTSIDE_BTN_H / 2 - (sublabel ? 2 : 0);
      this.addChild(mainTxt);

      if (sublabel) {
        const subTxt = new Text({
          text: sublabel,
          style: { fontSize: 9, fill: 0x888888, fontFamily: 'Arial' },
        });
        subTxt.anchor.set(0.5, 0);
        subTxt.x = x + OUTSIDE_BTN_W / 2;
        subTxt.y = y + OUTSIDE_BTN_H / 2 + 4;
        this.addChild(subTxt);
      }
    });
  }

  private drawOutsideBg(g: Graphics, selected: boolean): void {
    g.clear();
    g.roundRect(0, 0, OUTSIDE_BTN_W, OUTSIDE_BTN_H, 6);
    g.fill(selected ? OUTSIDE_SEL : 0x1c1c1c);
    g.roundRect(0, 0, OUTSIDE_BTN_W, OUTSIDE_BTN_H, 6);
    g.stroke({ color: selected ? SEL_BORDER : 0x383838, width: selected ? 2 : 1 });
  }

  private buildSummary(): void {
    this.summaryText = new Text({
      text: 'Select a bet to play',
      style: { fontSize: 11, fill: 0x555555, fontFamily: 'Arial', fontStyle: 'italic' },
    });
    this.summaryText.anchor.set(0.5, 0);
    this.summaryText.x = DESIGN_WIDTH / 2;
    this.summaryText.y = HUD.summaryY;
    this.addChild(this.summaryText);
  }

  private buildGrid(): void {
    // 4×4 grid: display numbers 0–15
    // Row 0: 0,1,2,3  — Row 1: 4,5,6,7  — Row 2: 8,9,10,11  — Row 3: 12,13,14,15
    for (let n = 0; n <= 15; n++) {
      const col  = n % TILE_COLS;
      const row  = Math.floor(n / TILE_COLS);
      const tx   = TILE_PAD_X + col * (TILE_W + TILE_GAP);
      const ty   = HUD.gridY  + row * (TILE_H + TILE_GAP);
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

      // Number label
      const isStripe = n >= 9;
      const ballDef  = n > 0 ? getBallDef(n) : null;
      const textColor = n === 0 ? 0x444444
                      : n === 8 ? 0xffffff
                      : isStripe ? (ballDef?.color ?? 0x333333)
                      : 0xffffff;

      const numTxt = new Text({
        text: String(n),
        style: {
          fontSize: n <= 9 ? 13 : 11,
          fontWeight: 'bold',
          fill: textColor,
          fontFamily: 'Arial',
        },
      });
      numTxt.anchor.set(n === 0 ? 0.5 : 0.5, n === 0 ? 0.35 : 0.5);
      numTxt.x = tx + TILE_W / 2;
      numTxt.y = ty + TILE_H / 2;
      this.addChild(numTxt);

      // "CUE" sublabel on tile 0
      if (n === 0) {
        const cueTxt = new Text({
          text: 'CUE',
          style: { fontSize: 7, fill: 0x888888, fontFamily: 'Arial', letterSpacing: 1 },
        });
        cueTxt.anchor.set(0.5, 0);
        cueTxt.x = tx + TILE_W / 2;
        cueTxt.y = ty + TILE_H / 2 + 2;
        this.addChild(cueTxt);
      }
    }
  }

  private drawTileBg(g: Graphics, displayN: number, selected: boolean): void {
    g.clear();
    const isStripe = displayN >= 9;
    const ballDef  = displayN > 0 ? getBallDef(displayN) : null;

    if (displayN === 0) {
      // Cue ball tile — ivory
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.fill(selected ? 0xe8e0cc : CUE_FILL);
    } else if (isStripe) {
      // Stripe tile — white bg with color band
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.fill(selected ? 0xf0f0e8 : 0xfafafa);
      // Color stripe across center third
      const bandY = TILE_H * 0.28;
      const bandH = TILE_H * 0.44;
      g.rect(0, bandY, TILE_W, bandH);
      g.fill(ballDef?.color ?? 0x888888);
      // Re-clip corners (draw transparent overlay is complex; rely on roundRect + overdraw)
    } else if (displayN === 8) {
      // 8-ball
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.fill(selected ? 0x333333 : 0x111111);
    } else {
      // Solid ball (1–7)
      const baseColor = ballDef?.color ?? 0x888888;
      const selColor  = lighten(baseColor, selected ? 0.25 : 0);
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.fill(selColor);
    }

    // Selection border
    if (selected) {
      g.roundRect(0, 0, TILE_W, TILE_H, 4);
      g.stroke({ color: SEL_BORDER, width: 2 });
    }
  }

  private buildActionRow(): void {
    const y  = HUD.actionRowY;
    const bY = y;   // buttons fill the full ACT_H row height

    // [−] button
    const minusBg = new Graphics();
    this.drawAdjBtn(minusBg);
    minusBg.x = ACT_PAD;
    minusBg.y = bY;
    minusBg.eventMode = 'static';
    minusBg.cursor    = 'pointer';
    minusBg.on('pointerdown', () => this.shiftBet(-1));
    this.addChild(minusBg);

    const minusTxt = new Text({
      text: '−',
      style: { fontSize: 20, fill: 0xcccccc, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    minusTxt.anchor.set(0.5);
    minusTxt.x = ACT_PAD + ACT_BTN / 2;
    minusTxt.y = bY + ACT_H / 2;
    this.addChild(minusTxt);

    // Bet display
    this.betDisplay = new Text({
      text: `$${this.bet.currentBet}`,
      style: { fontSize: 15, fontWeight: 'bold', fill: 0xf5f0e0, fontFamily: 'Arial' },
    });
    this.betDisplay.anchor.set(0.5);
    this.betDisplay.x = ACT_PAD + ACT_BTN + ACT_PAD + ACT_BET / 2;
    this.betDisplay.y = bY + ACT_H / 2;
    this.addChild(this.betDisplay);

    // [+] button
    const plusBg = new Graphics();
    this.drawAdjBtn(plusBg);
    const plusX = ACT_PAD + ACT_BTN + ACT_PAD + ACT_BET + ACT_PAD;
    plusBg.x = plusX;
    plusBg.y = bY;
    plusBg.eventMode = 'static';
    plusBg.cursor    = 'pointer';
    plusBg.on('pointerdown', () => this.shiftBet(+1));
    this.addChild(plusBg);

    const plusTxt = new Text({
      text: '+',
      style: { fontSize: 18, fill: 0xcccccc, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    plusTxt.anchor.set(0.5);
    plusTxt.x = plusX + ACT_BTN / 2;
    plusTxt.y = bY + ACT_H / 2;
    this.addChild(plusTxt);

    // BREAK button
    const breakX = plusX + ACT_BTN + ACT_PAD;
    const breakW = DESIGN_WIDTH - breakX - ACT_PAD;
    const breakCont = new Container();
    breakCont.x = breakX;
    breakCont.y = bY;

    this.breakBg = new Graphics();
    this.drawBreakBtn(false, breakW);
    breakCont.addChild(this.breakBg);

    this.breakLabel = new Text({
      text: 'BREAK',
      style: {
        fontSize: 17,
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

    // Store width for redraw
    (this.breakBg as any)._breakW = breakW;
  }

  private drawAdjBtn(g: Graphics): void {
    g.clear();
    g.roundRect(0, 0, ACT_BTN, ACT_H, 6);
    g.fill(0x1c1c1c);
    g.stroke({ color: 0x383838, width: 1 });
  }

  private drawBreakBtn(active: boolean, w: number): void {
    this.breakBg.clear();
    if (active) {
      this.breakBg.roundRect(0, 0, w, ACT_H, 8);
      this.breakBg.fill(0x1a6b3c);
      this.breakBg.roundRect(2, 2, w - 4, ACT_H - 4, 7);
      this.breakBg.fill(0x27a85e);
      this.breakBg.roundRect(4, 4, w - 8, ACT_H * 0.4, 5);
      this.breakBg.fill({ color: 0xffffff, alpha: 0.10 });
    } else {
      this.breakBg.roundRect(0, 0, w, ACT_H, 8);
      this.breakBg.fill(0x1a1a1a);
      this.breakBg.roundRect(2, 2, w - 4, ACT_H - 4, 7);
      this.breakBg.fill(0x262626);
    }
  }

  private handleBetClick(key: BetKey): void {
    if (this.input.isLocked()) return;
    if (this.sm.current !== GamePhase.BETTING) return;
    this.selectBet(key);
    this.onBetSelect(key);
  }

  private shiftBet(delta: number): void {
    if (this.input.isLocked()) return;
    if (!this.bet.canChangeBet()) return;
    const idx     = BET_OPTIONS.indexOf(this.bet.currentBet as any);
    const newIdx  = Math.max(0, Math.min(BET_OPTIONS.length - 1, idx + delta));
    const amount  = BET_OPTIONS[newIdx];
    if (amount === this.bet.currentBet) return;
    this.onBetChange(amount);
    this.betDisplay.text = `$${amount}`;
    this.updateSummary();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  setOnBetSelect(fn: (key: string) => void): void  { this.onBetSelect = fn; }
  setOnBreak(fn: () => void): void                 { this.onBreak = fn; }
  setOnBetChange(fn: (a: number) => void): void    { this.onBetChange = fn; }

  /** Highlight the given bet key and clear all others. */
  selectBet(key: string): void {
    // Redraw all outside buttons
    for (const { key: k } of OUTSIDE) {
      const bg = this.outsideBgs.get(k);
      if (bg) this.drawOutsideBg(bg, k === key);
    }
    // Redraw all tiles (0–15)
    for (let n = 0; n <= 15; n++) {
      const k  = displayToBetKey(n);
      const bg = this.tileBgs.get(k);
      if (bg) this.drawTileBg(bg, n, k === key);
    }
    this.updateSummary(key);
    this.refreshBreakButton();
  }

  deselectAll(): void {
    for (const { key } of OUTSIDE) {
      const bg = this.outsideBgs.get(key);
      if (bg) this.drawOutsideBg(bg, false);
    }
    for (let n = 0; n <= 15; n++) {
      const bg = this.tileBgs.get(displayToBetKey(n));
      if (bg) this.drawTileBg(bg, n, false);
    }
    this.updateSummary();
    this.refreshBreakButton();
  }

  refreshBreakButton(): void {
    const active = this.sm.canStartRound();
    const w      = (this.breakBg as any)._breakW ?? 198;
    this.drawBreakBtn(active, w);
  }

  updateBalance(): void {
    this.balanceText.text = `$${this.bet.balance.toLocaleString()}`;
    this.betDisplay.text  = `$${this.bet.currentBet}`;
    this.updateSummary();
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
    this.tileBgs.forEach(bg  => { bg.alpha  = alpha; });
    this.outsideBgs.forEach(bg => { bg.alpha = alpha; });
  }

  /** @deprecated kept for compatibility — bet cycling via action row now */
  updateBetHighlight(_current: number): void {
    this.betDisplay.text = `$${this.bet.currentBet}`;
  }

  resetForNewRound(): void {
    this.deselectAll();
    this.clearWin();
    this.updateBalance();
    this.setLocked(false);
    this.refreshBreakButton();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private updateSummary(key?: string): void {
    if (!key) {
      this.summaryText.style.fill = 0x555555;
      this.summaryText.style.fontStyle = 'italic';
      this.summaryText.text = 'Select a bet to play';
      return;
    }
    try {
      const def     = getBetDef(key as BetKey);
      const mult    = def.payoutMultiplier.toFixed(2);
      const returns = Math.floor(this.bet.currentBet * def.payoutMultiplier);
      this.summaryText.style.fill = 0xbbbbbb;
      this.summaryText.style.fontStyle = 'normal';
      this.summaryText.text = `${def.label}  ×${mult}  →  $${returns}`;
    } catch {
      // unknown key; ignore
    }
  }
}

// ── Utility: lighten a hex color by a fraction ────────────────────────────────
function lighten(color: number, amount: number): number {
  if (amount === 0) return color;
  const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((color >> 8)  & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, ( color        & 0xff)  + Math.round(255 * amount));
  return (r << 16) | (g << 8) | b;
}

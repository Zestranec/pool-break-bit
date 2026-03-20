import { Container, Graphics, Text } from 'pixi.js';
import { BallSprite } from '../objects/BallSprite';
import { BetController } from '../controllers/BetController';
import { InputController } from '../controllers/InputController';
import { StateMachine } from '../state/StateMachine';
import { GamePhase } from '../state/GameState';
import {
  DESIGN_WIDTH, HUD, BALL_COUNT, BALL_COLORS, TABLE,
  BALL_RADIUS,
} from '../config/gameConfig';
import { BET_OPTIONS } from '../config/paytable';
import { gsap } from 'gsap';

export class Hud extends Container {
  private balanceText!:  Text;
  private winText!:      Text;
  private betChips:      Graphics[] = [];
  private breakButton!:  Container;
  private breakBg!:      Graphics;
  private breakLabel!:   Text;
  private selectorBalls: BallSprite[] = [];

  private onBallSelect: (id: number) => void = () => {};
  private onBreak:      ()          => void = () => {};
  private onBetChange:  (amount: number) => void = () => {};

  constructor(
    private sm:    StateMachine,
    private bet:   BetController,
    private input: InputController,
  ) {
    super();
    this.buildBackground();
    this.buildBalanceRow();
    this.buildBallSelector();
    this.buildBetRow();
    this.buildBreakButton();
  }

  // ─── Builder helpers ───────────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = new Graphics();
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 500);
    bg.fill({ color: 0x0d0d0d, alpha: 1 });
    // Top separator line
    bg.rect(0, HUD.topY, DESIGN_WIDTH, 2);
    bg.fill({ color: 0x2a2a2a });
    this.addChild(bg);
  }

  private buildBalanceRow(): void {
    // Balance label
    const balLabel = new Text({
      text: 'BALANCE',
      style: { fontSize: 11, fill: 0x888888, fontFamily: 'Arial', letterSpacing: 2 },
    });
    balLabel.x = 16;
    balLabel.y = HUD.balanceY;
    this.addChild(balLabel);

    // Balance value
    this.balanceText = new Text({
      text: '$1,000',
      style: { fontSize: 20, fill: 0xf5f0e0, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.balanceText.x = 16;
    this.balanceText.y = HUD.balanceY + 15;
    this.addChild(this.balanceText);

    // Win display (right side, hidden until win)
    const winLabel = new Text({
      text: 'WIN',
      style: { fontSize: 11, fill: 0x888888, fontFamily: 'Arial', letterSpacing: 2 },
    });
    winLabel.x = DESIGN_WIDTH - 16 - 90;
    winLabel.y = HUD.balanceY;
    this.addChild(winLabel);

    this.winText = new Text({
      text: '',
      style: { fontSize: 20, fill: 0xffd700, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    this.winText.anchor.x = 1;
    this.winText.x = DESIGN_WIDTH - 16;
    this.winText.y = HUD.balanceY + 15;
    this.addChild(this.winText);
  }

  private buildBallSelector(): void {
    // Section label
    const label = new Text({
      text: 'SELECT YOUR BALL',
      style: { fontSize: 11, fill: 0x888888, fontFamily: 'Arial', letterSpacing: 2 },
    });
    label.anchor.set(0.5, 0);
    label.x = DESIGN_WIDTH / 2;
    label.y = HUD.labelY;
    this.addChild(label);

    // 8 ball chips in a row
    const chipR = 22;              // radius of selector chip
    const spacing = 6;
    const totalW  = BALL_COUNT * chipR * 2 + (BALL_COUNT - 1) * spacing;
    const startX  = (DESIGN_WIDTH - totalW) / 2 + chipR;

    for (let i = 0; i < BALL_COUNT; i++) {
      const ballId = i + 1;
      const bx = startX + i * (chipR * 2 + spacing);
      const chip = new BallSprite(ballId, bx, HUD.ballSelectorY);
      chip.scale.set(chipR / BALL_RADIUS);
      chip.eventMode = 'static';
      chip.cursor    = 'pointer';
      chip.on('pointerdown', () => {
        if (this.input.isLocked()) return;
        if (this.sm.current !== GamePhase.BETTING) return;
        this.selectBall(ballId);
        this.onBallSelect(ballId);
      });
      this.addChild(chip);
      this.selectorBalls.push(chip);
    }
  }

  private buildBetRow(): void {
    const betLabel = new Text({
      text: 'BET',
      style: { fontSize: 11, fill: 0x888888, fontFamily: 'Arial', letterSpacing: 2 },
    });
    betLabel.anchor.set(0.5, 0);
    betLabel.x = DESIGN_WIDTH / 2;
    betLabel.y = HUD.betLabelY;
    this.addChild(betLabel);

    // Bet amount chips
    const chipW  = 64;
    const chipH  = 32;
    const gap    = 8;
    const totalW = BET_OPTIONS.length * chipW + (BET_OPTIONS.length - 1) * gap;
    const startX = (DESIGN_WIDTH - totalW) / 2;

    BET_OPTIONS.forEach((amount, idx) => {
      const cx = startX + idx * (chipW + gap);
      const cy = HUD.betRowY - chipH / 2;

      const bg = new Graphics();
      bg.roundRect(0, 0, chipW, chipH, 6);
      bg.fill(0x222222);
      bg.stroke({ color: 0x444444, width: 1 });
      bg.x = cx;
      bg.y = cy;
      bg.eventMode = 'static';
      bg.cursor    = 'pointer';
      bg.on('pointerdown', () => {
        if (this.input.isLocked()) return;
        if (!this.bet.canChangeBet()) return;
        this.onBetChange(amount);
        this.updateBetHighlight(amount);
      });
      this.addChild(bg);
      this.betChips.push(bg);

      const txt = new Text({
        text: `$${amount}`,
        style: { fontSize: 13, fill: 0xcccccc, fontFamily: 'Arial', fontWeight: 'bold' },
      });
      txt.anchor.set(0.5);
      txt.x = cx + chipW / 2;
      txt.y = cy + chipH / 2;
      this.addChild(txt);
    });

    this.updateBetHighlight(this.bet.currentBet);
  }

  private buildBreakButton(): void {
    this.breakButton = new Container();
    this.breakButton.x = (DESIGN_WIDTH - HUD.breakButtonW) / 2;
    this.breakButton.y = HUD.breakButtonY - HUD.breakButtonH / 2;

    this.breakBg = new Graphics();
    this.drawBreakButton(false);
    this.breakButton.addChild(this.breakBg);

    this.breakLabel = new Text({
      text: 'BREAK',
      style: {
        fontSize: 22,
        fontWeight: 'bold',
        fill: 0xffffff,
        fontFamily: 'Arial',
        letterSpacing: 4,
      },
    });
    this.breakLabel.anchor.set(0.5);
    this.breakLabel.x = HUD.breakButtonW / 2;
    this.breakLabel.y = HUD.breakButtonH / 2;
    this.breakButton.addChild(this.breakLabel);

    this.breakButton.eventMode = 'static';
    this.breakButton.cursor    = 'pointer';
    this.breakButton.on('pointerdown', () => {
      if (this.input.isLocked()) return;
      if (!this.sm.canStartRound()) return;
      this.onBreak();
    });
    this.addChild(this.breakButton);
  }

  private drawBreakButton(active: boolean): void {
    this.breakBg.clear();
    if (active) {
      this.breakBg.roundRect(0, 0, HUD.breakButtonW, HUD.breakButtonH, 10);
      this.breakBg.fill(0x1a6b3c);
      this.breakBg.roundRect(2, 2, HUD.breakButtonW - 4, HUD.breakButtonH - 4, 9);
      this.breakBg.fill(0x27a85e);
      this.breakBg.roundRect(4, 4, HUD.breakButtonW - 8, HUD.breakButtonH * 0.45, 7);
      this.breakBg.fill({ color: 0xffffff, alpha: 0.12 });
    } else {
      this.breakBg.roundRect(0, 0, HUD.breakButtonW, HUD.breakButtonH, 10);
      this.breakBg.fill(0x1a1a1a);
      this.breakBg.roundRect(2, 2, HUD.breakButtonW - 4, HUD.breakButtonH - 4, 9);
      this.breakBg.fill(0x2a2a2a);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  setOnBallSelect(fn: (id: number) => void): void  { this.onBallSelect = fn; }
  setOnBreak(fn: () => void): void                 { this.onBreak = fn; }
  setOnBetChange(fn: (a: number) => void): void    { this.onBetChange = fn; }

  selectBall(ballId: number): void {
    this.selectorBalls.forEach(b => {
      if (b.ballId === ballId) b.select();
      else                     b.deselect();
    });
    this.refreshBreakButton();
  }

  deselectAll(): void {
    this.selectorBalls.forEach(b => b.deselect());
    this.refreshBreakButton();
  }

  refreshBreakButton(): void {
    const active = this.sm.canStartRound();
    this.drawBreakButton(active);
    if (active) {
      gsap.to(this.breakBg, { alpha: 1, duration: 0.2 });
    }
  }

  updateBalance(): void {
    this.balanceText.text = `$${this.bet.balance.toLocaleString()}`;
  }

  showWin(amount: number): void {
    this.winText.text = `+$${amount.toLocaleString()}`;
    gsap.fromTo(this.winText.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)' });
  }

  clearWin(): void {
    this.winText.text = '';
  }

  setLocked(locked: boolean): void {
    this.breakButton.alpha = locked ? 0.4 : 1;
    this.selectorBalls.forEach(b => {
      b.alpha = locked ? 0.5 : 1;
    });
  }

  updateBetHighlight(current: number): void {
    BET_OPTIONS.forEach((amount, idx) => {
      const chip = this.betChips[idx];
      chip.clear();
      if (amount === current) {
        chip.roundRect(0, 0, 64, 32, 6);
        chip.fill(0x1e5c30);
        chip.stroke({ color: 0x27a85e, width: 1.5 });
      } else {
        chip.roundRect(0, 0, 64, 32, 6);
        chip.fill(0x222222);
        chip.stroke({ color: 0x444444, width: 1 });
      }
    });
  }

  resetForNewRound(): void {
    this.deselectAll();
    this.clearWin();
    this.updateBalance();
    this.setLocked(false);
    this.refreshBreakButton();
  }
}

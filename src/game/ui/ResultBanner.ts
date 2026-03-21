import { Container, Graphics, Text } from 'pixi.js';
import { DESIGN_WIDTH, TABLE } from '../config/gameConfig';
import { gsap } from 'gsap';

const AUTO_HIDE_MS = 3000;

export class ResultBanner extends Container {
  private bg:        Graphics;
  private mainText:  Text;
  private subText:   Text;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.alpha   = 0;
    this.visible = false;

    // Backdrop
    this.bg = new Graphics();
    this.bg.roundRect(-130, -42, 260, 84, 12);
    this.bg.fill({ color: 0x000000, alpha: 0.88 });
    this.addChild(this.bg);

    // Outline
    const outline = new Graphics();
    outline.roundRect(-130, -42, 260, 84, 12);
    outline.stroke({ color: 0xffd700, width: 2 });
    this.addChild(outline);

    // Main label
    this.mainText = new Text({
      text: '',
      style: {
        fontSize: 38,
        fontWeight: 'bold',
        fill:       0xffd700,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
        },
      },
    });
    this.mainText.anchor.set(0.5);
    this.mainText.y = -10;
    this.addChild(this.mainText);

    // Sub label
    this.subText = new Text({
      text: '',
      style: { fontSize: 16, fill: 0xcccccc, fontFamily: 'Arial' },
    });
    this.subText.anchor.set(0.5);
    this.subText.y = 24;
    this.addChild(this.subText);

    // Position at centre of table area
    this.x = DESIGN_WIDTH / 2;
    this.y = TABLE.height / 2;
  }

  showWin(winAmount: number): void {
    this.bg.clear();
    this.bg.roundRect(-130, -42, 260, 84, 12);
    this.bg.fill({ color: 0x0a2a12, alpha: 0.94 });

    const outline = this.children[1] as Graphics;
    outline.clear();
    outline.roundRect(-130, -42, 260, 84, 12);
    outline.stroke({ color: 0xffd700, width: 2.5 });

    this.mainText.text  = '  WIN!  ';
    this.mainText.style.fill = 0xffd700;
    this.subText.text   = `+$${winAmount.toLocaleString()}`;
    this.subText.style.fill = 0x80ff80;

    this._show();
  }

  showLose(betAmount: number): void {
    this.bg.clear();
    this.bg.roundRect(-130, -42, 260, 84, 12);
    this.bg.fill({ color: 0x200a0a, alpha: 0.92 });

    const outline = this.children[1] as Graphics;
    outline.clear();
    outline.roundRect(-130, -42, 260, 84, 12);
    outline.stroke({ color: 0x882222, width: 2 });

    this.mainText.text       = ' MISS! ';
    this.mainText.style.fill = 0xff6666;
    this.subText.text        = `-$${betAmount}`;
    this.subText.style.fill  = 0xff8888;

    this._show();
  }

  private _show(): void {
    // Cancel any pending auto-hide from a previous result.
    this._clearTimer();

    this.visible = true;
    this.scale.set(0.6);
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.scale);
    gsap.to(this,       { alpha: 1,  duration: 0.3, ease: 'power2.out' });
    gsap.to(this.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' });

    // Auto-hide after 3 s so the table is clean before the next round.
    this._hideTimer = setTimeout(() => {
      this._hideTimer = null;
      this.hide();
    }, AUTO_HIDE_MS);
  }

  hide(): void {
    this._clearTimer();
    gsap.killTweensOf(this);
    gsap.to(this, {
      alpha: 0,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => { this.visible = false; },
    });
  }

  private _clearTimer(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }
}

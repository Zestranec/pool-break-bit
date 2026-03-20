import { Container, Graphics, Text, BlurFilter } from 'pixi.js';
import { BALL_RADIUS, BALL_COLORS } from '../config/gameConfig';
import { gsap } from 'gsap';

export class BallSprite extends Container {
  readonly ballId: number;      // 1-indexed
  readonly ballColor: number;

  private body:    Graphics;
  private glowRing: Graphics;
  private marker:  Container;  // "YOUR BET" chip/marker
  private labelText: Text;

  private _selected  = false;
  private _pocketed  = false;
  private _nearMiss  = false;

  constructor(ballId: number, x: number, y: number) {
    super();
    this.ballId    = ballId;
    this.ballColor = BALL_COLORS[ballId - 1];
    this.position.set(x, y);

    // ── Glow ring (shown when selected) ──────────────────────────────────────
    this.glowRing = new Graphics();
    this.glowRing.circle(0, 0, BALL_RADIUS + 5);
    this.glowRing.fill({ color: 0xffd700, alpha: 0.9 });
    this.glowRing.filters = [new BlurFilter({ strength: 6 })];
    this.glowRing.visible = false;
    this.addChild(this.glowRing);

    // ── Ball body ─────────────────────────────────────────────────────────────
    this.body = new Graphics();
    this.drawBody();
    this.addChild(this.body);

    // ── Number label ──────────────────────────────────────────────────────────
    this.labelText = new Text({
      text: String(ballId),
      style: {
        fontSize:   11,
        fontWeight: 'bold',
        fill:       this.ballId === 8 ? 0xffffff : 0x111111,
        fontFamily: 'Arial',
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.y = 1;
    this.addChild(this.labelText);

    // ── Bet marker ────────────────────────────────────────────────────────────
    this.marker = this.buildMarker();
    this.marker.visible = false;
    this.addChild(this.marker);

    // ── Interactivity ─────────────────────────────────────────────────────────
    this.eventMode = 'static';
    this.cursor    = 'pointer';
  }

  private drawBody(): void {
    this.body.clear();

    // Shadow under ball
    this.body.ellipse(2, 3, BALL_RADIUS - 1, BALL_RADIUS * 0.6);
    this.body.fill({ color: 0x000000, alpha: 0.25 });

    // Base colour
    this.body.circle(0, 0, BALL_RADIUS);
    this.body.fill(this.ballColor);

    // Subtle outline
    this.body.circle(0, 0, BALL_RADIUS);
    this.body.stroke({ color: 0x000000, width: 1.2, alpha: 0.4 });

    // Specular highlight — small white ellipse upper-left
    this.body.ellipse(-BALL_RADIUS * 0.28, -BALL_RADIUS * 0.32, BALL_RADIUS * 0.38, BALL_RADIUS * 0.24);
    this.body.fill({ color: 0xffffff, alpha: 0.38 });

    // Tiny sharp highlight dot
    this.body.circle(-BALL_RADIUS * 0.3, -BALL_RADIUS * 0.34, BALL_RADIUS * 0.12);
    this.body.fill({ color: 0xffffff, alpha: 0.75 });

    // White number circle
    this.body.circle(0, 1, BALL_RADIUS * 0.44);
    this.body.fill(0xffffff);
  }

  private buildMarker(): Container {
    const c = new Container();
    const chip = new Graphics();
    chip.roundRect(-20, -9, 40, 18, 4);
    chip.fill({ color: 0xffd700, alpha: 0.95 });
    chip.stroke({ color: 0xb8860b, width: 1 });
    c.addChild(chip);
    const txt = new Text({
      text: 'BET',
      style: { fontSize: 9, fontWeight: 'bold', fill: 0x333300, fontFamily: 'Arial' },
    });
    txt.anchor.set(0.5);
    c.addChild(txt);
    c.y = -(BALL_RADIUS + 14);
    return c;
  }

  // ─── State helpers ──────────────────────────────────────────────────────────
  select(): void {
    if (this._selected) return;
    this._selected = true;
    this.glowRing.visible = true;
    this.marker.visible   = true;
    gsap.to(this.scale, { x: 1.12, y: 1.12, duration: 0.18, ease: 'back.out(2)' });
    // Pulse animation on glow ring
    gsap.fromTo(
      this.glowRing.scale,
      { x: 1, y: 1 },
      { x: 1.2, y: 1.2, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 },
    );
  }

  deselect(): void {
    if (!this._selected) return;
    this._selected = false;
    this.glowRing.visible = false;
    this.marker.visible   = false;
    gsap.killTweensOf(this.glowRing.scale);
    gsap.to(this.scale, { x: 1, y: 1, duration: 0.12, ease: 'power2.out' });
  }

  /** Drop the ball into a pocket. */
  pocket(onComplete?: () => void): void {
    if (this._pocketed) return;
    this._pocketed = true;
    // Kill any ongoing movement tweens
    gsap.killTweensOf(this);
    // Scale to zero (drop in)
    gsap.to(this.scale, {
      x: 0, y: 0,
      duration: 0.22,
      ease: 'power2.in',
      onComplete,
    });
    // Fade out slightly faster
    gsap.to(this, { alpha: 0.3, duration: 0.2 });
  }

  /** Pulse once (used for near-miss approach emphasis). */
  pulseWarn(): void {
    gsap.fromTo(
      this.scale,
      { x: 1, y: 1 },
      { x: 1.2, y: 1.2, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 },
    );
  }

  resetForNewRound(x: number, y: number): void {
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.scale);
    gsap.killTweensOf(this.glowRing.scale);
    this._selected = false;
    this._pocketed = false;
    this._nearMiss = false;
    this.alpha     = 1;
    this.scale.set(1);
    this.visible   = true;
    this.glowRing.visible = false;
    this.marker.visible   = false;
    this.position.set(x, y);
  }

  get isPocketed(): boolean { return this._pocketed; }
  get isSelected(): boolean { return this._selected; }
}

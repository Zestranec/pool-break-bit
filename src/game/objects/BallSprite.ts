import { Container, Graphics, Text, BlurFilter } from 'pixi.js';
import { BALL_RADIUS } from '../config/gameConfig';
import { getBallDef, BallDef } from '../config/balls';
import { gsap } from 'gsap';

export class BallSprite extends Container {
  readonly ballId:  number;    // 1-indexed
  private def:      BallDef;

  private body:     Graphics;
  private glowRing: Graphics;
  private marker:   Container; // "BET" chip
  private labelText: Text;

  private _selected = false;
  private _pocketed = false;

  constructor(ballId: number, x: number, y: number) {
    super();
    this.ballId = ballId;
    this.def    = getBallDef(ballId);
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
    // Cue ball has no number; all other balls show their number in dark ink.
    // Font size is kept small to fit inside the proportionally-sized number
    // circle; at device-pixel-ratio 2–3 this is still crisp on mobile.
    this.labelText = new Text({
      text:  this.def.type === 'cue' ? '' : String(ballId),
      style: {
        fontSize:   9,
        fontWeight: 'bold',
        fill:       0x222222,
        fontFamily: 'Arial',
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.y = 0;
    this.addChild(this.labelText);

    // ── Bet marker ────────────────────────────────────────────────────────────
    this.marker = this.buildMarker();
    this.marker.visible = false;
    this.addChild(this.marker);

    // ── Interactivity ─────────────────────────────────────────────────────────
    this.eventMode = 'static';
    this.cursor    = 'pointer';
  }

  // ─── Drawing ────────────────────────────────────────────────────────────────

  private drawBody(): void {
    this.body.clear();
    const R = BALL_RADIUS;

    // Drop shadow (always)
    this.body.ellipse(2, 3, R - 1, R * 0.6);
    this.body.fill({ color: 0x000000, alpha: 0.25 });

    switch (this.def.type) {

      case 'solid':
      case 'black':
        this.drawSolid(R);
        break;

      case 'stripe':
        this.drawStripe(R);
        break;

      case 'cue':
        this.drawCue(R);
        break;
    }
  }

  /**
   * Solid ball: full color circle, specular, white number circle.
   * Same rendering for the 8-ball (type 'black') — its color constant is
   * already 0x111111 in the ball catalogue.
   */
  private drawSolid(R: number): void {
    // Base color fill
    this.body.circle(0, 0, R);
    this.body.fill(this.def.color);

    // Thin outline
    this.body.circle(0, 0, R);
    this.body.stroke({ color: 0x000000, width: 1.2, alpha: 0.4 });

    // Specular sheen — soft ellipse upper-left
    this.body.ellipse(-R * 0.28, -R * 0.32, R * 0.38, R * 0.24);
    this.body.fill({ color: 0xffffff, alpha: 0.38 });

    // Tiny sharp catchlight
    this.body.circle(-R * 0.30, -R * 0.34, R * 0.12);
    this.body.fill({ color: 0xffffff, alpha: 0.75 });

    // White number circle — 0.52 × R gives good clearance for two-digit labels
    this.body.circle(0, 0, R * 0.52);
    this.body.fill(0xffffff);
  }

  /**
   * Stripe ball: white base → colored horizontal band (painter's algorithm)
   * → outline stroke on top.
   *
   * The stripe band height is set so the white number circle (r = R×0.52)
   * centred at (0, 0) is fully contained within the colored band.
   * Required: band_half_height ≥ R×0.52 → band_height ≥ R×1.04.
   * We use R×1.12 (56 % of diameter) for a comfortable margin.
   *
   * The roundRect corners protrude ~0.9 px past the circle boundary at the
   * sub-pixel level; the 1.5 px outline drawn on top covers this perfectly.
   */
  private drawStripe(R: number): void {
    // White base
    this.body.circle(0, 0, R);
    this.body.fill(0xffffff);

    // Colored stripe band
    const sh = R * 1.12; // total stripe height
    this.body.roundRect(-R, -sh / 2, R * 2, sh, sh * 0.08);
    this.body.fill(this.def.color);

    // Outline drawn on top — cleans up the sub-pixel corner artefacts
    this.body.circle(0, 0, R);
    this.body.stroke({ color: 0x000000, width: 1.5, alpha: 0.45 });

    // Specular sheen
    this.body.ellipse(-R * 0.28, -R * 0.32, R * 0.38, R * 0.24);
    this.body.fill({ color: 0xffffff, alpha: 0.55 });

    this.body.circle(-R * 0.30, -R * 0.34, R * 0.12);
    this.body.fill({ color: 0xffffff, alpha: 0.80 });

    // White number circle (sits inside the stripe band)
    this.body.circle(0, 0, R * 0.52);
    this.body.fill(0xffffff);
  }

  /**
   * Cue ball: plain ivory/white, no number.
   */
  private drawCue(R: number): void {
    this.body.circle(0, 0, R);
    this.body.fill(0xf5f0e0);
    this.body.circle(0, 0, R);
    this.body.stroke({ color: 0xccbbaa, width: 1 });

    this.body.ellipse(-R * 0.25, -R * 0.30, R * 0.38, R * 0.22);
    this.body.fill({ color: 0xffffff, alpha: 0.55 });
  }

  // ─── Marker ──────────────────────────────────────────────────────────────────
  private buildMarker(): Container {
    const c    = new Container();
    const chip = new Graphics();
    chip.roundRect(-20, -9, 40, 18, 4);
    chip.fill({ color: 0xffd700, alpha: 0.95 });
    chip.stroke({ color: 0xb8860b, width: 1 });
    c.addChild(chip);
    const txt = new Text({
      text:  'BET',
      style: { fontSize: 9, fontWeight: 'bold', fill: 0x333300, fontFamily: 'Arial' },
    });
    txt.anchor.set(0.5);
    c.addChild(txt);
    c.y = -(BALL_RADIUS + 14);
    return c;
  }

  // ─── State helpers ───────────────────────────────────────────────────────────

  select(): void {
    if (this._selected) return;
    this._selected = true;
    this.glowRing.visible = true;
    this.marker.visible   = true;
    gsap.to(this.scale, { x: 1.12, y: 1.12, duration: 0.18, ease: 'back.out(2)' });
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

  pocket(onComplete?: () => void): void {
    if (this._pocketed) return;
    this._pocketed = true;
    gsap.killTweensOf(this);
    gsap.to(this.scale, { x: 0, y: 0, duration: 0.22, ease: 'power2.in', onComplete });
    gsap.to(this, { alpha: 0.3, duration: 0.2 });
  }

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

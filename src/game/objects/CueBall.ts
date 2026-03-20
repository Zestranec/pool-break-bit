import { Container, Graphics, BlurFilter } from 'pixi.js';
import { BALL_RADIUS } from '../config/gameConfig';
import { gsap } from 'gsap';

export class CueBall extends Container {
  private body: Graphics;
  /** The cue stick (long thin rectangle) */
  readonly stick: Graphics;

  constructor() {
    super();
    this.alpha   = 0;
    this.visible = false;

    // ── Ball body ─────────────────────────────────────────────────────────────
    this.body = new Graphics();
    this.drawBody();
    this.addChild(this.body);

    // ── Cue stick ─────────────────────────────────────────────────────────────
    this.stick = new Graphics();
    this.drawStick();
    this.stick.visible = false;
    this.addChild(this.stick);
  }

  private drawBody(): void {
    // Shadow
    this.body.ellipse(2, 3, BALL_RADIUS - 1, BALL_RADIUS * 0.55);
    this.body.fill({ color: 0x000000, alpha: 0.18 });

    // Base — ivory white
    this.body.circle(0, 0, BALL_RADIUS);
    this.body.fill(0xf5f0e0);
    this.body.circle(0, 0, BALL_RADIUS);
    this.body.stroke({ color: 0xccbbaa, width: 1 });

    // Specular highlight
    this.body.ellipse(-BALL_RADIUS * 0.25, -BALL_RADIUS * 0.3, BALL_RADIUS * 0.38, BALL_RADIUS * 0.22);
    this.body.fill({ color: 0xffffff, alpha: 0.55 });
  }

  private drawStick(): void {
    this.stick.clear();
    // Shaft — long rectangle extending downward from ball
    const shaftW = 6;
    const shaftH = 90;
    this.stick.roundRect(-shaftW / 2, BALL_RADIUS + 2, shaftW, shaftH, 3);
    this.stick.fill(0xd4a94e); // wood tan
    // Dark tip
    this.stick.roundRect(-shaftW / 2, BALL_RADIUS + 2, shaftW, 10, 3);
    this.stick.fill(0x3a2a0e);
    // Highlight strip
    this.stick.rect(-1, BALL_RADIUS + 12, 2, shaftH - 12);
    this.stick.fill({ color: 0xffffff, alpha: 0.2 });
  }

  /**
   * Show ball + stick at position, fully faded in.
   * The stick sits below the ball pointing downward.
   */
  showAt(x: number, y: number): Promise<void> {
    this.position.set(x, y);
    this.alpha   = 0;
    this.visible = true;
    this.stick.visible = true;
    // Address position: tip held ~14 px back from ball surface so there is
    // a visible gap before the pullback animation starts.
    this.stick.y = 14;

    return new Promise(resolve => {
      gsap.to(this, { alpha: 1, duration: 0.25, ease: 'power2.out', onComplete: resolve });
    });
  }

  /** Pull stick back from its current address position, then snap forward. */
  animateStrike(pullBackPx = 22): Promise<void> {
    const addressY = this.stick.y;  // wherever showAt placed the stick
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      // Pull back (relative to current address position)
      tl.to(this.stick, {
        y: addressY + pullBackPx,
        duration: 0.35,
        ease: 'power2.out',
      });
      // Strike — tip briefly passes the ball centre (contact point)
      tl.to(this.stick, {
        y: -4,
        duration: 0.16,
        ease: 'power3.in',
      });
      // Settle back to neutral
      tl.to(this.stick, {
        y: 0,
        duration: 0.1,
        ease: 'power2.out',
      });
    });
  }

  /** Move cue ball to target and hide stick. */
  travelTo(
    tx: number,
    ty: number,
    durationSec: number,
  ): Promise<void> {
    this.stick.visible = false;
    return new Promise(resolve => {
      gsap.to(this, {
        x: tx,
        y: ty,
        duration: durationSec,
        ease: 'power2.in',
        onComplete: resolve,
      });
    });
  }

  /** Impact burst (scale out + fade). */
  impact(): void {
    gsap.fromTo(
      this.scale,
      { x: 1, y: 1 },
      { x: 1.4, y: 1.4, duration: 0.08, ease: 'power3.out', yoyo: true, repeat: 1 },
    );
  }

  /** Fade out and hide after the impact. */
  disappear(): void {
    gsap.to(this, {
      alpha: 0,
      duration: 0.3,
      delay: 0.15,
      onComplete: () => { this.visible = false; },
    });
  }

  reset(): void {
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.scale);
    gsap.killTweensOf(this.stick);
    this.alpha       = 0;
    this.visible     = false;
    this.rotation    = 0;
    this.stick.visible = false;
    this.scale.set(1);
    this.stick.y = 0;
  }
}

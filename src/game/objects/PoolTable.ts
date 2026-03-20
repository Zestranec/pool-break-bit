import { Container, Graphics } from 'pixi.js';
import {
  TABLE, FELT, POCKETS, POCKET_RADIUS, BALL_RADIUS, DESIGN_WIDTH,
} from '../config/gameConfig';

export class PoolTable extends Container {
  private pocketFlashes: Map<number, Graphics> = new Map();

  constructor() {
    super();
    this.buildTable();
  }

  private buildTable(): void {
    // ── Outer rail / border ──────────────────────────────────────────────────
    const rail = new Graphics();
    rail.roundRect(0, 0, TABLE.width, TABLE.height, 8);
    rail.fill(TABLE.borderColor);
    // Inner highlight strip on rail
    rail.roundRect(2, 2, TABLE.width - 4, TABLE.height - 4, 7);
    rail.fill(TABLE.borderColorHi);
    this.addChild(rail);

    // ── Felt ─────────────────────────────────────────────────────────────────
    const felt = new Graphics();
    felt.rect(FELT.left, FELT.top, FELT.right - FELT.left, FELT.bottom - FELT.top);
    felt.fill(TABLE.feltColor);
    this.addChild(felt);

    // ── Subtle felt grain (diagonal thin lines) ──────────────────────────────
    const grain = new Graphics();
    grain.alpha = 0.04;
    for (let i = -TABLE.height; i < TABLE.width + TABLE.height; i += 14) {
      grain.moveTo(FELT.left + i, FELT.top);
      grain.lineTo(FELT.left + i + TABLE.height, FELT.bottom);
    }
    grain.stroke({ color: 0xffffff, width: 1 });
    this.addChild(grain);

    // ── Cushion inner edges ──────────────────────────────────────────────────
    const cushion = new Graphics();
    // Top
    cushion.moveTo(FELT.left + POCKET_RADIUS + 2, FELT.top);
    cushion.lineTo(TABLE.width / 2 - POCKET_RADIUS, FELT.top);
    cushion.moveTo(TABLE.width / 2 + POCKET_RADIUS, FELT.top);
    cushion.lineTo(FELT.right - POCKET_RADIUS - 2, FELT.top);
    // Bottom
    cushion.moveTo(FELT.left + POCKET_RADIUS + 2, FELT.bottom);
    cushion.lineTo(TABLE.width / 2 - POCKET_RADIUS, FELT.bottom);
    cushion.moveTo(TABLE.width / 2 + POCKET_RADIUS, FELT.bottom);
    cushion.lineTo(FELT.right - POCKET_RADIUS - 2, FELT.bottom);
    // Left
    cushion.moveTo(FELT.left, FELT.top + POCKET_RADIUS + 2);
    cushion.lineTo(FELT.left, FELT.bottom - POCKET_RADIUS - 2);
    // Right
    cushion.moveTo(FELT.right, FELT.top + POCKET_RADIUS + 2);
    cushion.lineTo(FELT.right, FELT.bottom - POCKET_RADIUS - 2);
    cushion.stroke({ color: TABLE.cushionColor, width: 3 });
    this.addChild(cushion);

    // ── Pocket holes ─────────────────────────────────────────────────────────
    for (const pocket of POCKETS) {
      const hole = new Graphics();
      hole.circle(pocket.x, pocket.y, POCKET_RADIUS);
      hole.fill(TABLE.pocketColor);
      // Dark ring
      hole.circle(pocket.x, pocket.y, POCKET_RADIUS);
      hole.stroke({ color: 0x000000, width: 2 });
      this.addChild(hole);

      // Per-pocket flash overlay (initially hidden)
      const flash = new Graphics();
      flash.circle(pocket.x, pocket.y, POCKET_RADIUS + 6);
      flash.fill({ color: 0xffd700, alpha: 0.85 });
      flash.visible = false;
      flash.alpha = 0;
      this.addChild(flash);
      this.pocketFlashes.set(pocket.id, flash);
    }

    // ── Table vignette (darkened corners) ───────────────────────────────────
    // Approximated with a dark semi-transparent overlay on edges
    const vig = new Graphics();
    vig.rect(FELT.left, FELT.top, FELT.right - FELT.left, FELT.bottom - FELT.top);
    vig.fill({ color: 0x000000, alpha: 0 }); // base (transparent)
    vig.alpha = 0;
    this.addChild(vig);

    // ── Centre spot ──────────────────────────────────────────────────────────
    const spot = new Graphics();
    spot.circle(TABLE.width / 2, TABLE.height / 2, 2.5);
    spot.fill({ color: 0xffffff, alpha: 0.25 });
    this.addChild(spot);

    // ── Head-string (break line) — dashed ────────────────────────────────────
    const headLine = new Graphics();
    headLine.alpha = 0.18;
    const hlY = FELT.top + (FELT.bottom - FELT.top) * 0.68;
    for (let x = FELT.left + 6; x < FELT.right - 6; x += 12) {
      headLine.moveTo(x, hlY);
      headLine.lineTo(Math.min(x + 7, FELT.right - 6), hlY);
    }
    headLine.stroke({ color: 0xffffff, width: 1 });
    this.addChild(headLine);
  }

  /** Flash the pocket glow when a ball is pocketed. */
  flashPocket(pocketId: number): void {
    const flash = this.pocketFlashes.get(pocketId);
    if (!flash) return;
    flash.visible = true;
    flash.alpha   = 1;
    // Fade out over 600 ms using PixiJS ticker
    let elapsed = 0;
    const ticker = (dt: { deltaMS: number }) => {
      elapsed += dt.deltaMS;
      flash.alpha = Math.max(0, 1 - elapsed / 600);
      if (elapsed >= 600) {
        flash.visible = false;
        flash.alpha   = 0;
        (flash as any)._pocketTickerRef && this.removeTickerListener(ticker);
      }
    };
    (flash as any)._pocketTickerRef = ticker;
    this.addTickerListener(ticker);
  }

  // These are wired up in Game after the app is ready
  private _tickerAdd: ((fn: (dt: { deltaMS: number }) => void) => void) | null = null;
  private _tickerRemove: ((fn: (dt: { deltaMS: number }) => void) => void) | null = null;

  setTickerFns(
    add:    (fn: (dt: { deltaMS: number }) => void) => void,
    remove: (fn: (dt: { deltaMS: number }) => void) => void,
  ): void {
    this._tickerAdd    = add;
    this._tickerRemove = remove;
  }

  private addTickerListener(fn: (dt: { deltaMS: number }) => void): void {
    this._tickerAdd?.(fn);
  }

  private removeTickerListener(fn: (dt: { deltaMS: number }) => void): void {
    this._tickerRemove?.(fn);
  }

  /** Brighten the felt slightly during a break for visual impact. */
  addTableShake(): void {
    const target = this;
    let t = 0;
    const shake = (dt: { deltaMS: number }) => {
      t += dt.deltaMS;
      const amp = Math.max(0, 1 - t / 300) * 3;
      target.x = (Math.random() - 0.5) * amp;
      target.y = (Math.random() - 0.5) * amp;
      if (t >= 300) {
        target.x = 0;
        target.y = 0;
        this.removeTickerListener(shake);
      }
    };
    this.addTickerListener(shake);
  }
}

// ── Vignette overlay drawn on top of the whole table area ───────────────────
export function buildTableVignette(): Graphics {
  const g = new Graphics();
  // Simple: semi-transparent black rect edges
  // Left edge
  g.rect(0, 0, 40, TABLE.height);
  g.fill({ color: 0x000000, alpha: 0.18 });
  // Right edge
  g.rect(DESIGN_WIDTH - 40, 0, 40, TABLE.height);
  g.fill({ color: 0x000000, alpha: 0.18 });
  // Top edge
  g.rect(0, 0, TABLE.width, 20);
  g.fill({ color: 0x000000, alpha: 0.12 });
  // Bottom edge
  g.rect(0, TABLE.height - 20, TABLE.width, 20);
  g.fill({ color: 0x000000, alpha: 0.12 });
  return g;
}

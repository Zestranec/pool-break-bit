import { Application, Container } from 'pixi.js';
import { DESIGN_WIDTH, DESIGN_HEIGHT, RACK_POSITIONS, TABLE } from './config/gameConfig';
import { DEFAULT_BET, STARTING_BALANCE } from './config/paytable';
import { createInitialState } from './state/GameState';
import { StateMachine }    from './state/StateMachine';
import { BetController }   from './controllers/BetController';
import { InputController } from './controllers/InputController';
import { RoundController } from './controllers/RoundController';
import { PoolTable, buildTableVignette } from './objects/PoolTable';
import { BallSprite }  from './objects/BallSprite';
import { CueBall }     from './objects/CueBall';
import { Hud }         from './ui/Hud';
import { ResultBanner } from './ui/ResultBanner';
import { GamePhase } from './state/GameState';

export class Game {
  private app!:     Application;
  private sm!:      StateMachine;
  private bet!:     BetController;
  private input!:   InputController;
  private round!:   RoundController;
  private table!:   PoolTable;
  private balls:    BallSprite[] = [];
  private cueBall!: CueBall;
  private hud!:     Hud;
  private banner!:  ResultBanner;

  async init(container: HTMLElement): Promise<void> {
    // ── PixiJS application ────────────────────────────────────────────────────
    this.app = new Application();
    await this.app.init({
      width:      DESIGN_WIDTH,
      height:     DESIGN_HEIGHT,
      background: 0x0d0d0d,
      antialias:  true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    container.appendChild(this.app.canvas);

    // Responsive scale
    this.fitToWindow();
    window.addEventListener('resize', () => this.fitToWindow());

    // ── State ─────────────────────────────────────────────────────────────────
    const state = createInitialState(STARTING_BALANCE, DEFAULT_BET);
    this.sm     = new StateMachine(state);
    this.bet    = new BetController(this.sm);
    this.input  = new InputController();

    // ── Scene graph ───────────────────────────────────────────────────────────
    // Table layer
    this.table = new PoolTable();
    this.table.setTickerFns(
      fn => this.app.ticker.add(fn),
      fn => this.app.ticker.remove(fn),
    );
    this.app.stage.addChild(this.table);

    // Vignette over table
    const vignette = buildTableVignette();
    this.app.stage.addChild(vignette);

    // Balls (1-8)
    const ballLayer = new Container();
    for (let i = 0; i < 8; i++) {
      const pos  = RACK_POSITIONS[i];
      const ball = new BallSprite(i + 1, pos.x, pos.y);
      this.balls.push(ball);
      ballLayer.addChild(ball);
    }
    this.app.stage.addChild(ballLayer);

    // Cue ball (on top of regular balls)
    this.cueBall = new CueBall();
    this.app.stage.addChild(this.cueBall);

    // HUD
    this.hud = new Hud(this.sm, this.bet, this.input);
    this.app.stage.addChild(this.hud);

    // Result banner (floats over the table)
    this.banner = new ResultBanner();
    this.app.stage.addChild(this.banner);

    // ── Wire up controllers ───────────────────────────────────────────────────
    this.round = new RoundController(
      this.sm, this.bet, this.input,
      this.balls, this.cueBall, this.table,
      this.hud, this.banner,
      fn => this.app.ticker.add(fn),
      fn => this.app.ticker.remove(fn),
    );

    // Ball selection
    this.hud.setOnBallSelect((ballId) => {
      this.sm.updateState({ selectedBallId: ballId });
      // Mirror selection on the table balls
      this.balls.forEach(b => {
        if (b.ballId === ballId) b.select();
        else                     b.deselect();
      });
      this.hud.selectBall(ballId);
    });

    // Bet change
    this.hud.setOnBetChange((amount) => {
      this.bet.setBet(amount as any);
      this.hud.updateBetHighlight(amount);
    });

    // Break button
    this.hud.setOnBreak(() => {
      this.round.startRound();
    });

    // ── Initial HUD state ─────────────────────────────────────────────────────
    this.hud.updateBalance();
    this.hud.refreshBreakButton();

    // ── Ambient table light pulse ─────────────────────────────────────────────
    this.startAmbientPulse();
  }

  private fitToWindow(): void {
    const canvas   = this.app.canvas as HTMLCanvasElement;
    const parent   = canvas.parentElement;
    if (!parent) return;
    const maxW     = Math.min(parent.clientWidth, 430);
    const scale    = maxW / DESIGN_WIDTH;
    canvas.style.width  = `${maxW}px`;
    canvas.style.height = `${Math.round(DESIGN_HEIGHT * scale)}px`;
  }

  /** Subtle felt brightness oscillation — purely decorative. */
  private startAmbientPulse(): void {
    let t = 0;
    this.app.ticker.add((ticker) => {
      t += ticker.deltaMS * 0.0006;
      // Very slight alpha shimmer on table (imperceptible but adds life)
      this.table.alpha = 0.98 + Math.sin(t) * 0.02;
    });
  }
}

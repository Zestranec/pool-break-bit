import { StateMachine } from '../state/StateMachine';
import { GamePhase } from '../state/GameState';
import { BetController } from './BetController';
import { OutcomeController } from './OutcomeController';
import { AnimationController } from './AnimationController';
import { InputController } from './InputController';
import { ProbabilityController } from './ProbabilityController';
import { BallSprite } from '../objects/BallSprite';
import { CueBall }    from '../objects/CueBall';
import { PoolTable }  from '../objects/PoolTable';
import { Hud }        from '../ui/Hud';
import { ResultBanner } from '../ui/ResultBanner';
import { RACK_POSITIONS } from '../config/gameConfig';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export class RoundController {
  private anim: AnimationController;
  private rng   = ProbabilityController.fresh();

  constructor(
    private sm:     StateMachine,
    private bet:    BetController,
    private input:  InputController,
    private balls:  BallSprite[],
    private cueBall: CueBall,
    private table:  PoolTable,
    private hud:    Hud,
    private banner: ResultBanner,
  ) {
    this.anim = new AnimationController(balls, cueBall, table);
  }

  /** Called when player hits BREAK. */
  async startRound(): Promise<void> {
    if (!this.sm.canStartRound()) return;

    const { selectedBallId, currentBet } = this.sm.gameState;
    if (selectedBallId === null) return;

    // ── Transition: betting → running ────────────────────────────────────────
    this.sm.transition(GamePhase.RUNNING);
    this.input.lock();
    this.hud.setLocked(true);
    this.banner.hide();

    // ── Deduct bet ────────────────────────────────────────────────────────────
    this.bet.placeBet();
    this.hud.updateBalance();

    // ── Resolve outcome BEFORE animation ─────────────────────────────────────
    const outcome = OutcomeController.resolve(selectedBallId, this.rng);
    this.sm.updateState({ lastOutcome: outcome, roundCount: this.sm.gameState.roundCount + 1 });

    // ── Highlight the selected ball on the table ──────────────────────────────
    const selectedBall = this.balls[selectedBallId - 1];
    selectedBall.select();

    // ── Play animation ────────────────────────────────────────────────────────
    await this.anim.play(outcome);

    // ── Small dramatic pause ──────────────────────────────────────────────────
    await sleep(350);

    // ── Resolve ───────────────────────────────────────────────────────────────
    this.sm.transition(GamePhase.RESOLVE);

    if (outcome.isWin) {
      const winAmount = this.bet.awardWin(outcome.payoutMultiplier);
      this.hud.updateBalance();
      this.hud.showWin(winAmount);
      this.sm.transition(GamePhase.WIN);
      this.banner.showWin(winAmount);
    } else {
      this.bet.recordLoss();
      this.sm.transition(GamePhase.LOSE);
      this.banner.showLose(currentBet);
    }

    // ── Auto-reset after delay ────────────────────────────────────────────────
    await sleep(2200);
    await this.reset();
  }

  private async reset(): Promise<void> {
    this.sm.transition(GamePhase.RESET);
    this.anim.killAll();

    this.banner.hide();
    this.cueBall.reset();

    // Return all balls to rack positions
    this.balls.forEach((ball, i) => {
      ball.resetForNewRound(RACK_POSITIONS[i].x, RACK_POSITIONS[i].y);
    });

    this.bet.ensureMinBalance();
    this.sm.updateState({ selectedBallId: null });

    await sleep(200);

    this.sm.transition(GamePhase.BETTING);
    this.input.unlock();
    this.hud.resetForNewRound();
  }
}

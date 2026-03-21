import { StateMachine } from '../state/StateMachine';
import { GamePhase } from '../state/GameState';
import { BetController } from './BetController';
import { InputController } from './InputController';
import { ProbabilityController } from './ProbabilityController';
import { ReplaySelectionPolicy } from './ReplaySelectionPolicy';
import { ReplayLoader }   from '../replay/ReplayLoader';
import { ReplaySelector } from '../replay/ReplaySelector';
import { ReplayPlayer }   from '../replay/ReplayPlayer';
import { BallSprite } from '../objects/BallSprite';
import { CueBall }    from '../objects/CueBall';
import { PoolTable }  from '../objects/PoolTable';
import { Hud }        from '../ui/Hud';
import { ResultBanner } from '../ui/ResultBanner';
import { getBetDef } from '../config/paytable';
import { RACK_POSITIONS } from '../config/gameConfig';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

type TickerFn = (dt: { deltaMS: number }) => void;

export class RoundController {
  private policy   = new ReplaySelectionPolicy();
  private loader   = new ReplayLoader('/data');
  private selector = new ReplaySelector();
  private player:  ReplayPlayer;
  private _rng     = ProbabilityController.fresh(); // kept for any future use

  constructor(
    private sm:          StateMachine,
    private bet:         BetController,
    private input:       InputController,
    private balls:       BallSprite[],
    private cueBall:     CueBall,
    private table:       PoolTable,
    private hud:         Hud,
    private banner:      ResultBanner,
    tickerAdd:           (fn: TickerFn) => void,
    tickerRemove:        (fn: TickerFn) => void,
  ) {
    this.player = new ReplayPlayer(tickerAdd, tickerRemove);
  }

  /** Called when player hits BREAK. */
  async startRound(): Promise<void> {
    if (!this.sm.canStartRound()) return;

    const { selectedBetKey, currentBet } = this.sm.gameState;
    if (selectedBetKey === null) return;

    // ── Transition: betting → running ────────────────────────────────────────
    this.sm.transition(GamePhase.RUNNING);
    this.input.lock();
    this.hud.setLocked(true);
    this.banner.hide();

    // ── Deduct bet ────────────────────────────────────────────────────────────
    this.bet.placeBet();
    this.hud.updateBalance();

    // ── Draw winning ball via selection policy ────────────────────────────────
    const winnerBallId = this.policy.drawWinner(selectedBetKey);

    // ── Select and load the matching replay ───────────────────────────────────
    const index     = await this.loader.loadIndex();
    const fileName  = this.selector.pick(winnerBallId, index);
    const roundData = await this.loader.loadRound(fileName);

    // ── Remap ball sprites to match this replay's ball config ─────────────────
    // roundData.bc[slot] = ballId assigned to rack slot in the recorded round.
    for (let slot = 0; slot < 15; slot++) {
      this.balls[slot].assignBall(roundData.bc[slot]);
    }

    // ── Highlight covered balls ───────────────────────────────────────────────
    const betDef = getBetDef(selectedBetKey);
    this.balls.forEach(b => {
      if (betDef && betDef.balls.includes(b.ballId)) b.select();
      else                                            b.deselect();
    });

    // ── Play the replay ───────────────────────────────────────────────────────
    await this.player.play(roundData, this.balls, this.cueBall, this.table);

    // ── Small dramatic pause ──────────────────────────────────────────────────
    await sleep(350);

    // ── Resolve outcome ───────────────────────────────────────────────────────
    this.sm.transition(GamePhase.RESOLVE);
    const { won, payout } = this.policy.resolveOutcome(
      winnerBallId, selectedBetKey, currentBet,
    );

    if (won) {
      const multiplier = payout / currentBet; // reconstruct for BetController
      const winAmount  = this.bet.awardWin(multiplier);
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
    // Cancel any pending auto-hide timer and hide immediately.
    this.banner.hide();
    this.cueBall.reset();

    // Return all balls to rack positions (ball IDs stay as last assigned)
    this.balls.forEach((ball, i) => {
      ball.resetForNewRound(RACK_POSITIONS[i].x, RACK_POSITIONS[i].y);
    });

    this.bet.ensureMinBalance();
    this.sm.updateState({ selectedBetKey: null });

    await sleep(200);

    this.sm.transition(GamePhase.BETTING);
    this.input.unlock();
    this.hud.resetForNewRound();
  }
}

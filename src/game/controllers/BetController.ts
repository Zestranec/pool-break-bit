import { BET_OPTIONS, BetAmount, DEFAULT_BET } from '../config/paytable';
import { StateMachine } from '../state/StateMachine';
import { GamePhase } from '../state/GameState';

export class BetController {
  private sm: StateMachine;

  constructor(sm: StateMachine) {
    this.sm = sm;
  }

  get currentBet(): number  { return this.sm.gameState.currentBet; }
  get balance():    number  { return this.sm.gameState.balance; }
  get options():    readonly BetAmount[] { return BET_OPTIONS; }

  canChangeBet(): boolean {
    return (
      this.sm.current === GamePhase.BETTING ||
      this.sm.current === GamePhase.IDLE
    );
  }

  setBet(amount: BetAmount): void {
    if (!this.canChangeBet()) return;
    this.sm.updateState({ currentBet: amount });
  }

  /** Deduct bet from balance when a round starts. */
  placeBet(): boolean {
    const { balance, currentBet } = this.sm.gameState;
    if (balance < currentBet) return false;
    this.sm.updateState({ balance: balance - currentBet });
    return true;
  }

  /** Award winnings. */
  awardWin(multiplier: number): number {
    const { balance, currentBet } = this.sm.gameState;
    const winAmount = Math.floor(currentBet * multiplier);
    this.sm.updateState({
      balance:       balance + winAmount,
      lastWinAmount: winAmount,
    });
    return winAmount;
  }

  /** On loss, just record zero win. */
  recordLoss(): void {
    this.sm.updateState({ lastWinAmount: 0 });
  }

  /** Ensure player has enough balance; top-up for demo purposes. */
  ensureMinBalance(min: number = DEFAULT_BET): void {
    if (this.sm.gameState.balance < min) {
      this.sm.updateState({ balance: 1000 });
    }
  }
}

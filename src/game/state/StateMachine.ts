import { GamePhase, GameState } from './GameState';

type TransitionListener = (from: GamePhase, to: GamePhase, state: GameState) => void;

export class StateMachine {
  private state: GameState;
  private listeners: TransitionListener[] = [];

  // Valid transitions
  private static TRANSITIONS: Partial<Record<GamePhase, GamePhase[]>> = {
    [GamePhase.IDLE]:    [GamePhase.BETTING],
    [GamePhase.BETTING]: [GamePhase.RUNNING],
    [GamePhase.RUNNING]: [GamePhase.RESOLVE],
    [GamePhase.RESOLVE]: [GamePhase.WIN, GamePhase.LOSE],
    [GamePhase.WIN]:     [GamePhase.RESET],
    [GamePhase.LOSE]:    [GamePhase.RESET],
    [GamePhase.RESET]:   [GamePhase.BETTING],
  };

  constructor(state: GameState) {
    this.state = state;
  }

  get current(): GamePhase { return this.state.phase; }
  get gameState(): GameState { return this.state; }

  transition(to: GamePhase): void {
    const allowed = StateMachine.TRANSITIONS[this.state.phase] ?? [];
    if (!allowed.includes(to)) {
      console.warn(`Invalid transition: ${this.state.phase} → ${to}`);
      return;
    }
    const from = this.state.phase;
    this.state.phase = to;
    this.listeners.forEach(fn => fn(from, to, this.state));
  }

  /** Convenience: can we fire the BREAK button right now? */
  canStartRound(): boolean {
    return (
      this.state.phase === GamePhase.BETTING &&
      this.state.selectedBallId !== null &&
      this.state.balance >= this.state.currentBet
    );
  }

  onTransition(fn: TransitionListener): void {
    this.listeners.push(fn);
  }

  updateState(patch: Partial<GameState>): void {
    Object.assign(this.state, patch);
  }
}

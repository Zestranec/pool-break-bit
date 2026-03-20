// ─── Game states ─────────────────────────────────────────────────────────────
export enum GamePhase {
  IDLE    = 'idle',
  BETTING = 'betting',
  RUNNING = 'running',
  RESOLVE = 'resolve',
  WIN     = 'win',
  LOSE    = 'lose',
  RESET   = 'reset',
}

// ─── Outcome produced before animation ───────────────────────────────────────
export interface RoundOutcome {
  seed:                    number;
  selectedBallId:          number;  // 1-indexed ball the player bet on
  winningBallId:           number;  // 1-indexed ball that pockets first
  isWin:                   boolean;
  payoutMultiplier:        number;
  cueBallStartPresetId:    number;
  winningPocketId:         number;  // 0-5
  firstPocketTimeSec:      number;  // seconds from scatter start when winner pockets
  scatterPresetId:         string;
  nearMissBallId?:         number;  // player's ball rolls near a pocket and deflects
  nearMissPocketId?:       number;  // which pocket it approaches
  secondaryPocketedBallIds?: number[]; // extra balls that pocket after the winner
}

// ─── Live game state ──────────────────────────────────────────────────────────
export interface GameState {
  phase:           GamePhase;
  balance:         number;
  currentBet:      number;
  selectedBallId:  number | null; // null = not yet chosen
  lastOutcome:     RoundOutcome | null;
  lastWinAmount:   number;
  roundCount:      number;
}

export function createInitialState(balance: number, defaultBet: number): GameState {
  return {
    phase:          GamePhase.BETTING,
    balance,
    currentBet:     defaultBet,
    selectedBallId: null,
    lastOutcome:    null,
    lastWinAmount:  0,
    roundCount:     0,
  };
}

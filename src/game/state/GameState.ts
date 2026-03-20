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
  selectedBetKey:          string;           // BetKey chosen by the player
  outcomeResult:           number;           // 1–17 drawn result
  winningBallId:           number | null;    // 1–15 when a ball pockets; null for outcomes 16–17
  isWin:                   boolean;
  payoutMultiplier:        number;
  cueBallSpawnX:           number;
  cueBallSpawnY:           number;
  winningPocketId:         number;           // 0–5; used when winningBallId is non-null
  firstPocketTimeSec:      number;           // seconds from scatter start when winner pockets
  scatterPresetId:         string;
  nearMissBallId?:         number;           // ball that rolls near a pocket and deflects
  nearMissPocketId?:       number;
  secondaryPocketedBallIds?: number[];       // extra balls that pocket after the winner
}

// ─── Live game state ──────────────────────────────────────────────────────────
export interface GameState {
  phase:           GamePhase;
  balance:         number;
  currentBet:      number;
  selectedBetKey:  string | null;   // null = nothing chosen yet
  lastOutcome:     RoundOutcome | null;
  lastWinAmount:   number;
  roundCount:      number;
}

export function createInitialState(balance: number, defaultBet: number): GameState {
  return {
    phase:          GamePhase.BETTING,
    balance,
    currentBet:     defaultBet,
    selectedBetKey: null,
    lastOutcome:    null,
    lastWinAmount:  0,
    roundCount:     0,
  };
}

/**
 * InputController: lightweight debounce / lock layer.
 * All user interactions route through here so double-triggers are impossible
 * and the game loop never needs to check multiple flag sources.
 */
export class InputController {
  private locked = false;

  lock():   void { this.locked = true; }
  unlock(): void { this.locked = false; }
  isLocked(): boolean { return this.locked; }

  /** Wrap a callback so it only fires when unlocked — and is single-fire. */
  guard(fn: () => void): () => void {
    return () => {
      if (!this.locked) fn();
    };
  }
}

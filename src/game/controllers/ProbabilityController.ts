/**
 * Seeded pseudo-random number generator (mulberry32).
 * Fully deterministic for a given seed — same seed → same sequence.
 */
export class ProbabilityController {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 0xffffffff);
  }

  /** Advance seed and return a float in [0, 1). */
  next(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Float in [min, max). */
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Pick a random element from an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(arr.length)];
  }

  getSeed(): number { return this.seed; }

  /** Create a new controller with a fresh random seed. */
  static fresh(): ProbabilityController {
    return new ProbabilityController(
      Math.floor(Math.random() * 0xffffffff)
    );
  }
}

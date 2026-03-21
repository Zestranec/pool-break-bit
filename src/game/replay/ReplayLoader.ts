/**
 * ReplayLoader
 *
 * Fetches the dataset index from public/data/index.json and individual
 * round JSON files on demand.  Caches everything in memory so the same
 * file is never fetched twice.
 */

import { type RoundData, type IndexEntry } from './ReplayTypes';

export class ReplayLoader {
  private readonly baseUrl: string;
  private index: IndexEntry[] | null = null;
  private cache = new Map<string, RoundData>();

  /** @param baseUrl – URL prefix for the data directory, e.g. '/data' */
  constructor(baseUrl = '/data') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Load (or return cached) the dataset index. */
  async loadIndex(): Promise<IndexEntry[]> {
    if (this.index) return this.index;
    const res = await fetch(`${this.baseUrl}/index.json`);
    if (!res.ok) throw new Error(`Failed to load index: ${res.status}`);
    const raw = (await res.json()) as IndexEntry[];
    this.index = raw;
    return raw;
  }

  /** Load (or return cached) a single round file by filename. */
  async loadRound(fileName: string): Promise<RoundData> {
    const cached = this.cache.get(fileName);
    if (cached) return cached;
    const res = await fetch(`${this.baseUrl}/rounds/${fileName}`);
    if (!res.ok) throw new Error(`Failed to load round ${fileName}: ${res.status}`);
    const data = (await res.json()) as RoundData;
    this.cache.set(fileName, data);
    return data;
  }

  /** Eagerly pre-fetch a list of round files into the cache. */
  async prefetch(fileNames: string[]): Promise<void> {
    await Promise.all(fileNames.map(f => this.loadRound(f)));
  }
}

/**
 * Tiles loaded rather than baked: each wanted tile of one level is loaded asynchronously, the
 * nearest first, with a cap on how many load at once; a load the view no longer wants is aborted;
 * and tiles held past the bound are released, the longest unwanted first.
 */
import type { TileScheme } from './scheme';

/** How a stream loads and frees a tile's payload. */
export interface TileStreamOptions<K, V, P> {
  scheme: TileScheme<K, V>;
  /** The one level every tile is loaded at. */
  level: number;
  load(key: K, signal: AbortSignal): Promise<P>;
  /** Free a payload the stream let go of. */
  release(key: K, payload: P): void;
  /** Loads at once. Default 4. */
  maxConcurrent?: number;
  /** Tiles held at once; never fewer than the view wants. Default 256. */
  maxHeld?: number;
  /** A load that fails is reported here, and asked for again on a later update. */
  onError?(key: K, error: unknown): void;
}

interface Held<K, P> { key: K; payload: P; wantedAt: number }
interface Loading<K> { key: K; abort: AbortController }

/** Tiles loaded around a moving view. */
export class TileStream<K, V, P> {
  private readonly held = new Map<string, Held<K, P>>();
  private readonly loading = new Map<string, Loading<K>>();
  private queue: K[] = [];
  private update_ = 0;
  private wantedCount = 0;
  private disposed = false;

  constructor(private readonly opts: TileStreamOptions<K, V, P>) {}

  /** Tiles held now. */
  get count(): number {
    return this.held.size;
  }

  /** Loads under way. */
  get inFlight(): number {
    return this.loading.size;
  }

  /** Tiles wanted and neither held nor loading. */
  get waiting(): number {
    return this.queue.length;
  }

  /** The payload held for `key`, if any. */
  payloadOf(key: K): P | undefined {
    return this.held.get(this.opts.scheme.idOf(key))?.payload;
  }

  /**
   * Want what `view` shows and its ring, then what `ahead` shows (where a fling will land), in that
   * order; abort loads of anything no longer wanted; start loads up to the cap; and release held
   * tiles past the bound, the longest unwanted first.
   */
  update(view: V, ahead?: V): void {
    if (this.disposed) return;
    const { scheme, level } = this.opts;
    const n = ++this.update_;
    const wanted: K[] = [];
    const seen = new Set<string>();
    const want = (k: K) => {
      const id = scheme.idOf(k);
      if (seen.has(id)) return;
      seen.add(id);
      wanted.push(k);
    };
    for (const w of scheme.wanted(view, level)) if (!w.ring) want(w.key);
    for (const w of scheme.wanted(view, level)) if (w.ring) want(w.key);
    if (ahead) for (const w of scheme.wanted(ahead, level)) want(w.key);
    for (const k of wanted) {
      const h = this.held.get(scheme.idOf(k));
      if (h) h.wantedAt = n;
    }
    // An aborted load still counts against the cap until it settles: the source is still busy with it.
    for (const [id, l] of this.loading) if (!seen.has(id)) l.abort.abort();
    this.queue = wanted.filter((k) => {
      const id = scheme.idOf(k);
      return !this.held.has(id) && !this.loading.has(id);
    });
    this.wantedCount = wanted.length;
    this.pump();
    this.trim();
  }

  /** Release every tile and abort every load. */
  dispose(): void {
    this.disposed = true;
    for (const l of this.loading.values()) l.abort.abort();
    this.loading.clear();
    this.queue = [];
    for (const h of this.held.values()) this.opts.release(h.key, h.payload);
    this.held.clear();
  }

  private pump(): void {
    const cap = this.opts.maxConcurrent ?? 4;
    while (this.loading.size < cap && this.queue.length > 0) {
      const key = this.queue.shift()!;
      const id = this.opts.scheme.idOf(key);
      const abort = new AbortController();
      this.loading.set(id, { key, abort });
      const done = () => {
        if (this.loading.get(id)?.abort === abort) this.loading.delete(id);
        this.pump();
      };
      let loaded: Promise<P>;
      try {
        loaded = this.opts.load(key, abort.signal);
      } catch (error) {
        loaded = Promise.reject(error);
      }
      loaded.then((payload) => {
        if (abort.signal.aborted || this.disposed) {
          this.opts.release(key, payload);
        } else {
          this.held.set(id, { key, payload, wantedAt: this.update_ });
          this.trim();
        }
        done();
      }, (error: unknown) => {
        if (!abort.signal.aborted) this.opts.onError?.(key, error);
        done();
      });
    }
  }

  private trim(): void {
    const max = Math.max(this.opts.maxHeld ?? 256, this.wantedCount);
    if (this.held.size <= max) return;
    const order = [...this.held.entries()].sort((a, b) => a[1].wantedAt - b[1].wantedAt);
    for (const [id, h] of order) {
      if (this.held.size <= max) break;
      if (h.wantedAt === this.update_) break;
      this.held.delete(id);
      this.opts.release(h.key, h.payload);
    }
  }
}

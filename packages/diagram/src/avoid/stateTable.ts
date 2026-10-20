/**
 * The per-state arrays one search fills in — best cost, parent, settled, and
 * each step's cost — kept between searches and cleared by bumping a stamp
 * rather than by refilling, since a router runs hundreds of searches a commit.
 */
export class StateTable {
  private g = new Float64Array(0);
  private from = new Int32Array(0);
  private costStamp = new Uint32Array(0);
  private doneStamp = new Uint32Array(0);
  private step = new Float64Array(0);
  private stepStamp = new Uint32Array(0);
  private gen = 0;

  /** Forget every state. */
  reset(): void {
    if (this.gen >= 0xfffffff0) {
      this.costStamp.fill(0);
      this.doneStamp.fill(0);
      this.stepStamp.fill(0);
      this.gen = 0;
    }
    this.gen++;
  }

  /** Make room for states `0` to `n - 1`, keeping what is there. */
  ensure(n: number): void {
    if (n <= this.g.length) return;
    const size = Math.max(n, this.g.length * 2, 1024);
    const grow = <T extends Float64Array | Int32Array | Uint32Array>(a: T, make: (n: number) => T): T => {
      const b = make(size);
      b.set(a);
      return b;
    };
    this.g = grow(this.g, (k) => new Float64Array(k));
    this.from = grow(this.from, (k) => new Int32Array(k));
    this.costStamp = grow(this.costStamp, (k) => new Uint32Array(k));
    this.doneStamp = grow(this.doneStamp, (k) => new Uint32Array(k));
    this.step = grow(this.step, (k) => new Float64Array(k));
    this.stepStamp = grow(this.stepStamp, (k) => new Uint32Array(k));
  }

  cost(s: number): number {
    return this.costStamp[s] === this.gen ? this.g[s]! : Infinity;
  }

  /** The state `s` was reached from, or -1 for a start. */
  parent(s: number): number {
    return this.from[s]!;
  }

  reach(s: number, cost: number, parent: number): void {
    this.g[s] = cost;
    this.from[s] = parent;
    this.costStamp[s] = this.gen;
  }

  done(s: number): boolean {
    return this.doneStamp[s] === this.gen;
  }

  settle(s: number): void {
    this.doneStamp[s] = this.gen;
  }

  /** The cost remembered for step `key`, or NaN. */
  stepCost(key: number): number {
    return this.stepStamp[key] === this.gen ? this.step[key]! : NaN;
  }

  rememberStep(key: number, cost: number): void {
    this.step[key] = cost;
    this.stepStamp[key] = this.gen;
  }
}

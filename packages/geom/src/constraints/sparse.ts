/**
 * The damped normal equations of a constraint solve, `(J M Jᵀ + λI) y = b`,
 * kept sparse. Each row of `J` reads a handful of coordinates, so two rows
 * meet in the normal matrix only when they share one. The rows are put in
 * reverse Cuthill-McKee order, which packs those meetings near the diagonal,
 * and the matrix is factored by Cholesky inside that envelope: a chain of
 * constraints along a path costs time linear in its length, where the dense
 * solve cost its cube.
 */

/** A row's position in `order` for each row, and the rows in that order. */
function reverseCuthillMcKee(neighbors: readonly number[][]): { order: Int32Array; rank: Int32Array } {
  const m = neighbors.length;
  const order = new Int32Array(m);
  const rank = new Int32Array(m).fill(-1);
  const byDegree = [...neighbors.keys()].sort((a, b) => neighbors[a].length - neighbors[b].length);
  let n = 0;
  for (const start of byDegree) {
    if (rank[start] >= 0) continue;
    rank[start] = n;
    order[n++] = start;
    for (let head = n - 1; head < n; head++) {
      const next = neighbors[order[head]].filter((q) => rank[q] < 0)
        .sort((a, b) => neighbors[a].length - neighbors[b].length);
      for (const q of next) {
        rank[q] = n;
        order[n++] = q;
      }
    }
  }
  order.reverse();
  order.forEach((row, i) => { rank[row] = i; });
  return { order, rank };
}

export class NormalSystem {
  private readonly cols: Int32Array[];
  private readonly vals: Float64Array[];
  private readonly mobility: Float64Array;
  private readonly rank: Int32Array;
  /** For each row in envelope order, the first column its envelope holds, and where its entries start. */
  private readonly first: Int32Array;
  private readonly offset: Int32Array;
  private readonly env: Float64Array;
  /**
   * Each product one coordinate makes between two rows' entries:
   * envelope position, the two rows, their slots, and the coordinate's mobility.
   */
  private readonly pairs: { pos: Int32Array; p: Int32Array; sp: Int32Array; q: Int32Array; sq: Int32Array; w: Float64Array };

  /** `rowCols[p]` lists the coordinates row `p` may read; one whose `mobility` is 0 is dropped. */
  constructor(rowCols: readonly Int32Array[], mobility: Float64Array) {
    this.mobility = mobility;
    this.cols = rowCols.map((c) => Int32Array.from(new Set(c)).filter((v) => mobility[v] > 0));
    this.vals = this.cols.map((c) => new Float64Array(c.length));
    const m = this.cols.length;
    const readers = new Map<number, { row: number; slot: number }[]>();
    this.cols.forEach((c, row) => c.forEach((v, slot) => {
      let list = readers.get(v);
      if (!list) readers.set(v, (list = []));
      list.push({ row, slot });
    }));
    const linked = Array.from({ length: m }, () => new Set<number>());
    for (const list of readers.values()) {
      for (const a of list) for (const b of list) if (a.row !== b.row) linked[a.row].add(b.row);
    }
    const { rank } = reverseCuthillMcKee(linked.map((s) => [...s]));
    this.rank = rank;
    this.first = new Int32Array(m);
    for (let p = 0; p < m; p++) {
      let f = rank[p];
      for (const q of linked[p]) f = Math.min(f, rank[q]);
      this.first[rank[p]] = f;
    }
    this.offset = new Int32Array(m + 1);
    for (let i = 0; i < m; i++) this.offset[i + 1] = this.offset[i] + i - this.first[i] + 1;
    this.env = new Float64Array(this.offset[m]);

    const pos: number[] = [];
    const ps: number[] = [];
    const sps: number[] = [];
    const qs: number[] = [];
    const sqs: number[] = [];
    const ws: number[] = [];
    for (const [v, list] of readers) {
      for (const a of list) {
        for (const b of list) {
          const i = rank[a.row];
          const j = rank[b.row];
          if (j > i) continue;
          pos.push(this.at(i, j));
          ps.push(a.row);
          sps.push(a.slot);
          qs.push(b.row);
          sqs.push(b.slot);
          ws.push(mobility[v]);
        }
      }
    }
    this.pairs = {
      pos: Int32Array.from(pos), p: Int32Array.from(ps), sp: Int32Array.from(sps),
      q: Int32Array.from(qs), sq: Int32Array.from(sqs), w: Float64Array.from(ws),
    };
  }

  /** Rows. */
  get m(): number {
    return this.cols.length;
  }

  private at(i: number, j: number): number {
    return this.offset[i] + j - this.first[i];
  }

  /** Zero every entry of `J`. */
  clear(): void {
    for (const v of this.vals) v.fill(0);
  }

  /** Add `d` to `J[row][v]`; nothing when the row cannot move `v`. */
  add(row: number, v: number, d: number): void {
    const c = this.cols[row];
    for (let k = 0; k < c.length; k++) {
      if (c[k] === v) {
        this.vals[row][k] += d;
        return;
      }
    }
  }

  /** `y` for `(J M Jᵀ + λI) y = b`, or null when the matrix will not factor. */
  solve(b: Float64Array, lambda: number): Float64Array | null {
    const { env, first, offset, pairs, vals, rank } = this;
    const m = this.m;
    env.fill(0);
    for (let k = 0; k < pairs.pos.length; k++) {
      env[pairs.pos[k]] += vals[pairs.p[k]][pairs.sp[k]] * pairs.w[k] * vals[pairs.q[k]][pairs.sq[k]];
    }
    for (let i = 0; i < m; i++) env[offset[i + 1] - 1] += lambda;
    // Cholesky in place, L sharing A's envelope.
    for (let i = 0; i < m; i++) {
      const fi = first[i];
      for (let j = fi; j <= i; j++) {
        const fj = first[j];
        let s = env[offset[i] + j - fi];
        for (let k = Math.max(fi, fj); k < j; k++) s -= env[offset[i] + k - fi] * env[offset[j] + k - fj];
        if (j < i) env[offset[i] + j - fi] = s / env[offset[j + 1] - 1];
        else if (s > 0) env[offset[i + 1] - 1] = Math.sqrt(s);
        else return null;
      }
    }
    const z = new Float64Array(m);
    for (let p = 0; p < m; p++) z[rank[p]] = b[p];
    for (let i = 0; i < m; i++) {
      let s = z[i];
      for (let k = first[i]; k < i; k++) s -= env[offset[i] + k - first[i]] * z[k];
      z[i] = s / env[offset[i + 1] - 1];
    }
    for (let i = m - 1; i >= 0; i--) {
      z[i] /= env[offset[i + 1] - 1];
      for (let k = first[i]; k < i; k++) z[k] -= env[offset[i] + k - first[i]] * z[i];
    }
    const y = new Float64Array(m);
    for (let p = 0; p < m; p++) y[p] = z[rank[p]];
    return y;
  }

  /** The step `-M Jᵀ y` over every coordinate the mobility names. */
  step(y: Float64Array): Float64Array {
    const delta = new Float64Array(this.mobility.length);
    this.cols.forEach((c, p) => c.forEach((v, k) => {
      delta[v] -= this.mobility[v] * this.vals[p][k] * y[p];
    }));
    return delta;
  }
}

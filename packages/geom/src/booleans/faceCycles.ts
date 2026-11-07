/** The cycles of a linked arrangement, the connected pieces they belong to, and each input's winding in each. */

/** Half-edges as `arrangement.ts` stores them: `h` runs from `origin[h]` to `origin[h ^ 1]`. */
export interface Linked {
  xs: readonly number[];
  ys: readonly number[];
  origin: readonly number[];
  next: readonly number[];
}

/**
 * The face on the left of each half-edge, as a cycle: a face's outer boundary
 * has positive area, and each connected piece of the arrangement has one
 * cycle of least area, its boundary seen from outside.
 */
export interface Cycles {
  cycleOf: Int32Array;
  cycles: number[][];
  area: Float64Array;
  /** Per cycle, the connected piece it lies in. */
  piece: Int32Array;
  /** Per piece, its outside cycle. */
  outside: Map<number, number>;
}

function pieceOfVertex(a: Linked): Int32Array {
  const parent = Int32Array.from({ length: a.xs.length }, (_, i) => i);
  const find = (v: number): number => {
    while (parent[v] !== v) { parent[v] = parent[parent[v]!]!; v = parent[v]!; }
    return v;
  };
  for (let h = 0; h < a.origin.length; h += 2) parent[find(a.origin[h]!)] = find(a.origin[h + 1]!);
  for (let v = 0; v < parent.length; v++) parent[v] = find(v);
  return parent;
}

export function cyclesOf(a: Linked): Cycles {
  const pieceOf = pieceOfVertex(a);
  const cycleOf = new Int32Array(a.origin.length).fill(-1);
  const cycles: number[][] = [];
  const area: number[] = [];
  const piece: number[] = [];
  for (let start = 0; start < a.origin.length; start++) {
    if (cycleOf[start] !== -1) continue;
    const c: number[] = [];
    let twice = 0;
    let h = start;
    do {
      cycleOf[h] = cycles.length;
      c.push(h);
      const u = a.origin[h]!, v = a.origin[h ^ 1]!;
      twice += a.xs[u]! * a.ys[v]! - a.xs[v]! * a.ys[u]!;
      h = a.next[h]!;
    } while (h !== start);
    cycles.push(c);
    area.push(twice / 2);
    piece.push(pieceOf[a.origin[start]!]!);
  }
  const outside = new Map<number, number>();
  piece.forEach((p, i) => {
    const best = outside.get(p);
    if (best === undefined || area[i]! < area[best]!) outside.set(p, i);
  });
  return { cycleOf, cycles, area: Float64Array.from(area), piece: Int32Array.from(piece), outside };
}

/** The leftmost, then lowest, vertex on cycle `c`. */
export function leftmost(a: Linked, cycle: readonly number[]): number {
  let best = a.origin[cycle[0]!]!;
  for (const h of cycle) {
    const v = a.origin[h]!;
    if (a.xs[v]! < a.xs[best]! || (a.xs[v]! === a.xs[best]! && a.ys[v]! < a.ys[best]!)) best = v;
  }
  return best;
}

/**
 * Each input's winding number in the face left of every cycle: cycle c's at
 * `[c * inputs, (c + 1) * inputs)`. `runs[e]` says how many times each input's
 * outline runs along edge `e` from its start to its end, as `[input, count]`
 * pairs, and raises that input's winding on the edge's left. Each piece's
 * outside is seeded by a ray from its leftmost vertex across the other pieces'
 * edges, and the rest follow edge by edge.
 */
export function cycleWindings(a: Linked, c: Cycles, runs: readonly (readonly number[])[], inputs: number): Int16Array {
  const winding = new Int16Array(c.cycles.length * inputs);
  const done = new Uint8Array(c.cycles.length);
  const edgePiece = (e: number) => c.piece[c.cycleOf[2 * e]!]!;
  for (const [piece, start] of c.outside) {
    const v = leftmost(a, c.cycles[start]!);
    const px = a.xs[v]!, py = a.ys[v]!;
    const base = start * inputs;
    for (let e = 0; e < runs.length; e++) {
      const u = a.origin[2 * e]!, w = a.origin[2 * e + 1]!;
      const y0 = a.ys[u]!, y1 = a.ys[w]!;
      if ((y0 > py) === (y1 > py) || edgePiece(e) === piece) continue;
      const x = a.xs[u]! + ((py - y0) / (y1 - y0)) * (a.xs[w]! - a.xs[u]!);
      if (x <= px) continue;
      const sign = y1 > y0 ? 1 : -1;
      const r = runs[e]!;
      for (let k = 0; k < r.length; k += 2) winding[base + r[k]!] += sign * r[k + 1]!;
    }
    done[start] = 1;
    const queue = [start];
    while (queue.length > 0) {
      const f = queue.pop()!;
      for (const h of c.cycles[f]!) {
        const g = c.cycleOf[h ^ 1]!;
        if (done[g]) continue;
        winding.copyWithin(g * inputs, f * inputs, (f + 1) * inputs);
        const sign = h & 1 ? 1 : -1;
        const r = runs[h >> 1]!;
        for (let k = 0; k < r.length; k += 2) winding[g * inputs + r[k]!] += sign * r[k + 1]!;
        done[g] = 1;
        queue.push(g);
      }
    }
  }
  return winding;
}

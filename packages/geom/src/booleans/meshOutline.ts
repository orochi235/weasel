/**
 * A triangle mesh's boundary as one ring whose winding number at every point
 * is how many of its triangles cover that point. Edges two triangles share in
 * opposite directions cancel, so a union of the ring under the nonzero rule
 * sweeps only the mesh's outline rather than every interior edge, and none of
 * the near-parallel crossings a thin ribbon's overlapping triangles make.
 */
import type { Pair, Ring } from './adapter';

/**
 * The boundary of `rings`, each a closed triangle ring (as `junctionRings`
 * gives them), as one closed ring, or null when every edge cancels. Each
 * triangle counts once, whichever way it winds. Separate loops of the
 * boundary are joined by a bridge walked out and back, which adds nothing to
 * the winding.
 */
export function meshOutline(rings: readonly Ring[]): Ring | null {
  const points = new Map<string, Pair>();
  // Directed edge counts, keyed `from|to`; an edge and its reverse cancel.
  const edges = new Map<string, number>();
  const keyOf = (p: Pair): string => {
    const k = `${p[0]},${p[1]}`;
    if (!points.has(k)) points.set(k, p);
    return k;
  };
  for (const ring of rings) {
    const keys = ring.slice(0, -1).map(keyOf);
    if (ringArea(ring) < 0) keys.reverse();
    for (let i = 0; i < keys.length; i++) {
      const a = keys[i], b = keys[(i + 1) % keys.length];
      if (a === b) continue;
      const back = `${b}|${a}`;
      const n = edges.get(back);
      if (n) {
        if (n === 1) edges.delete(back); else edges.set(back, n - 1);
      } else {
        const fwd = `${a}|${b}`;
        edges.set(fwd, (edges.get(fwd) ?? 0) + 1);
      }
    }
  }
  const loops = walkLoops(edges).map((loop) => loop.map((k) => points.get(k)!));
  return loops.length === 0 ? null : bridge(loops);
}

/** The directed edges left in `edges`, chained into closed loops of point keys. */
function walkLoops(edges: Map<string, number>): string[][] {
  const out = new Map<string, string[]>();
  for (const [edge, n] of edges) {
    const [a, b] = edge.split('|');
    let list = out.get(a);
    if (!list) out.set(a, (list = []));
    for (let i = 0; i < n; i++) list.push(b);
  }
  const loops: string[][] = [];
  for (const start of out.keys()) {
    while ((out.get(start)?.length ?? 0) > 0) {
      const loop = [start];
      let at = out.get(start)!.pop()!;
      while (at !== start) {
        loop.push(at);
        const next = out.get(at);
        // Every point has as many edges in as out, so a walk can only end
        // where it began.
        at = next!.pop()!;
      }
      loops.push(loop);
    }
  }
  return loops;
}

/**
 * `loops` as one closed ring: each loop entered at its leftmost point from
 * the previous loop's, walked round, and left the way it came in, so every
 * bridge is crossed once each way.
 */
function bridge(loops: Pair[][]): Ring {
  const entered = loops.map((loop) => {
    let k = 0;
    for (let i = 1; i < loop.length; i++) if (loop[i][0] < loop[k][0] || (loop[i][0] === loop[k][0] && loop[i][1] < loop[k][1])) k = i;
    return [...loop.slice(k), ...loop.slice(0, k)];
  });
  entered.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1]);
  const ring: Ring = [];
  for (const loop of entered) ring.push(...loop, loop[0]);
  for (let i = entered.length - 2; i >= 0; i--) ring.push(entered[i][0]);
  return ring;
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i + 1 < ring.length; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a;
}

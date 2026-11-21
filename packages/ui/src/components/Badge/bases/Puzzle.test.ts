import { describe, expect, it } from 'vitest';
import Puzzle, { type BadgePuzzleEdge } from './Puzzle';

const vertices = (path: string) => [...path.matchAll(/[ML] (-?[\d.e-]+) (-?[\d.e-]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

type P = readonly [number, number];
const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const crosses = (a: P, b: P, c: P, d: P) =>
  cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;

function selfIntersects(verts: P[]): boolean {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (crosses(verts[i]!, verts[(i + 1) % n]!, verts[j]!, verts[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

describe('the puzzle base', () => {
  it('keeps every pair of sockets apart at the largest tab size', () => {
    const edges: BadgePuzzleEdge[] = ['flat', 'out', 'in'];
    for (const top of edges) for (const right of edges) for (const bottom of edges) for (const left of edges) {
      const verts = vertices(Puzzle.build({ top, right, bottom, left, tabSize: 40 }, 80, 80).bodyPath);
      expect(selfIntersects(verts), `${top} ${right} ${bottom} ${left}`).toBe(false);
    }
  });

  it('draws a 40 tab where no two sockets could meet', () => {
    const at = (tabSize: number) => Puzzle.build({ top: 'out', right: 'flat', bottom: 'out', left: 'in', tabSize }, 80, 80).bodyPath;
    expect(at(40)).not.toBe(at(30));
  });
});

import { describe, expect, it } from 'vitest';
import { backEdges, longestPathRanks } from './layered';
import { graphOf, type Box } from './layoutFixture';
import { radial } from './radial';
import { tree } from './tree';

function chainOf(length: number, closed = false) {
  const ids = Array.from({ length }, (_, i) => `n${i}`);
  const boxes: Record<string, Box> = Object.fromEntries(ids.map((id) => [id, [0, 0]]));
  const links = ids.slice(1).map((id, i) => [ids[i]!, id] as const);
  return { ids, graph: graphOf(boxes, closed ? [...links, [ids.at(-1)!, ids[0]!] as const] : links) };
}

describe('a chain deeper than the call stack', () => {
  it('lays out as a tree and radially', () => {
    const { graph } = chainOf(20_000);
    for (const layout of [tree, radial]) {
      const moves = layout(graph, {});
      expect(moves.size).toBeGreaterThan(0);
      for (const p of moves.values()) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it('ranks with no back edges, one rank per link', () => {
    const { ids, graph } = chainOf(200_000);
    const back = backEdges(graph);
    expect(back.size).toBe(0);
    expect(longestPathRanks(graph, back).get(ids.at(-1)!)).toBe(ids.length - 1);
  });

  it('breaks the one cycle a closing edge makes', () => {
    expect(backEdges(chainOf(200_000, true).graph).size).toBe(1);
  });
});

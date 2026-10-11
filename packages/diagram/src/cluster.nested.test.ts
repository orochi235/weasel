import { describe, it, expect } from 'vitest';
import { force } from './force';
import { layered } from './layered';
import { tree } from './tree';
import { contains, graphOf, nestedBoxOf, overlaps, placed } from './groupFixture';

// A system holding two subsystems and a node of its own, beside an outsider
// every part of it talks to. Ungrouped, the outsider's edges pull it into the
// middle of the others in every rank.
const IDS = ['in', 'p0', 'mid', 'q0', 'p1', 'out', 'q1', 's'];
const EDGES = [
  ['in', 'p0'], ['in', 'q0'], ['p0', 'p1'], ['q0', 'q1'], ['p0', 'q1'], ['q0', 'p1'],
  ['p1', 's'], ['q1', 's'], ['in', 'out'], ['out', 's'], ['p0', 'out'], ['in', 'mid'], ['mid', 's'],
] as const;
const GROUPS = { System: ['P', 's', 'Q'], P: ['p0', 'p1'], Q: ['q0', 'q1'] };

describe.each([
  ['layered', layered],
  ['tree', tree],
  ['force', force],
] as const)('%s with a group inside a group', (name, fn) => {
  const boxes = () => {
    const graph = graphOf(IDS, EDGES, GROUPS);
    const at = placed(graph, fn);
    const box = (id: string) => nestedBoxOf(at, GROUPS, id, 12);
    return { graph, at, system: box('System'), p: box('P'), q: box('Q') };
  };

  it('reads the inner groups as members of the outer one', () => {
    const { graph } = boxes();
    const byId = new Map(graph.groups!.map((g) => [g.id, g]));
    expect(byId.get('P')!.parent).toBe('System');
    expect(byId.get('System')!.members).toEqual(['p0', 'p1', 's', 'q0', 'q1']);
    expect(graph.node('p0')!.group).toBe('P');
    expect(graph.node('s')!.group).toBe('System');
  });

  it('keeps the two inner boxes clear of each other', () => {
    const { p, q } = boxes();
    expect(overlaps(p, q), `P ${JSON.stringify(p)} Q ${JSON.stringify(q)}`).toBe(false);
  });

  it('keeps the outer group\'s own node out of the inner boxes', () => {
    const { at, p, q } = boxes();
    expect(overlaps(p, at.get('s')!)).toBe(false);
    expect(overlaps(q, at.get('s')!)).toBe(false);
  });

  it('keeps outsiders out of the outer box', () => {
    const { at, system } = boxes();
    expect(overlaps(system, at.get('in')!), `System ${JSON.stringify(system)} in ${JSON.stringify(at.get('in'))}`).toBe(false);
    expect(overlaps(system, at.get('out')!), `System ${JSON.stringify(system)} out ${JSON.stringify(at.get('out'))}`).toBe(false);
    expect(overlaps(system, at.get('mid')!), `System ${JSON.stringify(system)} mid ${JSON.stringify(at.get('mid'))}`).toBe(false);
  });

  it('holds the inner boxes inside the outer one, with its inset to spare', () => {
    const { system, p, q } = boxes();
    const grown = (r: typeof p) => ({ x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24 });
    expect(contains(system, grown(p))).toBe(true);
    expect(contains(system, grown(q))).toBe(true);
  });

  if (name !== 'force') {
    it('moves nothing on a second run', () => {
      const { at } = boxes();
      const again = graphOf(IDS, EDGES, GROUPS);
      for (const n of again.nodes) n.bounds = at.get(n.id)!;
      expect(fn(again).size).toBe(0);
    });
  }
});

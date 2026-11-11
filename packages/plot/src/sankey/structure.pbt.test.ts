/**
 * A sankey's structural edits on any sankey: a default link flows from the last link's target to a node no link
 * names, taking a node out takes exactly the links touching it, and a link's end set to a name reads back trimmed,
 * the other links untouched.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, sankeyData, tally } from '../pbt.fixture';
import { sankeyNodes } from './layout';
import { insertSankeyLink, removeSankeyNode, setSankeyEnd } from './structure';

const RUNS = 300;

describe('sankey structure', () => {
  it('adds a default link from the last target to a node no link names', () => {
    fc.assert(fc.property(sankeyData, fc.nat(), (data, at) => {
      const k = at % (data.links.length + 1);
      const next = insertSankeyLink(data, k);
      const link = next.links[k]!;
      expect(sankeyNodes(data)).not.toContain(link.target);
      expect(link.target).not.toBe(link.source);
      if (data.links.length > 0) expect(link.source).toBe(data.links.at(-1)!.target);
      expect(next.links.filter((_, i) => i !== k)).toEqual(data.links);
    }), runs(RUNS));
  });

  it('takes out exactly the links touching a node, and sets a link\'s end trimmed', () => {
    const seen = tally();
    fc.assert(fc.property(sankeyData, fc.nat(), fc.nat(), fc.constantFrom('source' as const, 'target' as const), fc.constantFrom(' a ', 'b', 'new', ' __proto__', '\tz'),
      (data, i, j, end, name) => {
        const nodes = sankeyNodes(data);
        if (nodes.length > 0) {
          const node = nodes[i % nodes.length]!;
          const next = removeSankeyNode(data, node);
          expect(next.links).toEqual(data.links.filter((l) => l.source !== node && l.target !== node));
          expect(sankeyNodes(next)).not.toContain(node);
          seen.count('removed');
        }
        if (data.links.length > 0) {
          const k = j % data.links.length;
          const next = setSankeyEnd(data, k, end, name);
          expect(next.links[k]![end]).toBe(name.trim());
          expect(next.links.filter((_, x) => x !== k)).toEqual(data.links.filter((_, x) => x !== k));
          seen.count('set');
        }
      }), runs(RUNS));
    seen.atLeast('removed', RUNS / 2);
    seen.atLeast('set', RUNS / 2);
  });
});

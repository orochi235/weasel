/**
 * A sankey's layout conserves flow: every ribbon is as thick at both ends, the ribbons at a node stack inside it
 * without gaps or overlap, a node is as tall as the larger of what flows in and out, and a column's nodes sit apart
 * inside the box.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, sankeyData, tally, timeoutFor } from '../pbt.fixture';
import { sankeyLayout, sankeyNodes } from './layout';

const RUNS = 400;
const box = fc.record({
  x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 1, max: 2000 }), height: fc.integer({ min: 1, max: 2000 }),
});

describe('sankeyLayout', () => {
  it('conserves flow at every node, inside the box', () => {
    const seen = tally();
    fc.assert(fc.property(sankeyData, box, (data, b) => {
      const layout = sankeyLayout(data, b);
      const labels = sankeyNodes(data);
      expect(layout.nodes.map((n) => n.label)).toEqual(labels);
      expect(layout.links).toHaveLength(data.links.length);
      const eps = 1e-6 * Math.max(1, b.height);
      for (const r of layout.links) {
        expect(Math.abs((r.from.y1 - r.from.y0) - (r.to.y1 - r.to.y0))).toBeLessThanOrEqual(eps);
        expect(r.from.y1).toBeGreaterThanOrEqual(r.from.y0);
        const [s, t] = [layout.nodes[r.source]!, layout.nodes[r.target]!];
        expect(r.from.x).toBe(s.x + s.width);
        expect(r.to.x).toBe(t.x);
      }
      layout.nodes.forEach((node, k) => {
        expect(node.height).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(b.y - eps);
        expect(node.y + node.height).toBeLessThanOrEqual(b.y + b.height + eps);
        expect(node.x).toBeGreaterThanOrEqual(b.x - eps);
        expect(node.x + node.width).toBeLessThanOrEqual(b.x + Math.max(b.width, node.width) + eps);
        for (const side of ['from', 'to'] as const) {
          const mine = layout.links.filter((r) => (side === 'from' ? r.source : r.target) === k).map((r) => r[side]).sort((p, q) => p.y0 - q.y0 || p.y1 - q.y1);
          let at = node.y;
          for (const r of mine) {
            expect(Math.abs(r.y0 - at)).toBeLessThanOrEqual(eps);
            at = r.y1;
          }
          expect(at).toBeLessThanOrEqual(node.y + node.height + eps);
          if (mine.length > 0) seen.count(side);
        }
        const ins = layout.links.filter((r) => r.target === k).reduce((a, r) => a + (r.to.y1 - r.to.y0), 0);
        const outs = layout.links.filter((r) => r.source === k).reduce((a, r) => a + (r.from.y1 - r.from.y0), 0);
        expect(Math.abs(node.height - Math.max(ins, outs))).toBeLessThanOrEqual(eps * Math.max(1, layout.links.length));
      });
      for (let c = 0; c < layout.columns; c++) {
        const col = layout.nodes.filter((n) => n.column === c).sort((p, q) => p.y - q.y);
        for (let i = 1; i < col.length; i++) expect(col[i]!.y).toBeGreaterThanOrEqual(col[i - 1]!.y + col[i - 1]!.height - eps);
        if (col.length > 1) seen.count('stacked');
      }
    }), runs(RUNS));
    seen.atLeast('from', RUNS / 2);
    seen.atLeast('to', RUNS / 2);
    seen.atLeast('stacked', RUNS / 4);
  }, timeoutFor(RUNS, 3));

  it('puts each link\'s target in a later column, unless the link closes a cycle', () => {
    const seen = tally();
    fc.assert(fc.property(sankeyData, (data) => {
      const layout = sankeyLayout(data, { x: 0, y: 0, width: 600, height: 400 });
      const forward = layout.links.filter((r) => layout.nodes[r.target]!.column > layout.nodes[r.source]!.column);
      for (const r of layout.links) if (!forward.includes(r)) seen.count('back');
      // Every link left out of the columns closes a cycle through the ones kept.
      const reach = (from: number, to: number): boolean => {
        const seenNodes = new Set<number>();
        const stack = [from];
        while (stack.length > 0) {
          const k = stack.pop()!;
          if (k === to) return true;
          if (seenNodes.has(k)) continue;
          seenNodes.add(k);
          for (const r of forward) if (r.source === k) stack.push(r.target);
        }
        return false;
      };
      for (const r of layout.links) if (!forward.includes(r)) expect(reach(r.target, r.source)).toBe(true);
      if (forward.length > 0) seen.count('forward');
    }), runs(RUNS));
    seen.atLeast('forward', RUNS / 2);
    seen.atLeast('back', RUNS / 20);
  }, timeoutFor(RUNS, 2));
});

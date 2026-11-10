import { describe, expect, it } from 'vitest';
import { asGraph } from '../testing/asGraph';
import { docOf } from '../pbt.fixture';
import { DRAW_XML } from './format';

describe('draw-style XML, shrunk counterexamples', () => {
  it('gives two edges with the same ends cells of their own, so an end label stays on its edge', async () => {
    const doc = docOf({
      nodes: [{ id: 'c', lines: [], at: { x: 40, y: 40 }, width: 100, height: 40 }],
      edges: [{ from: 'c', to: 'c' }, { from: 'c', to: 'c', endLabels: { to: 'a' } }],
    });
    const text = DRAW_XML.write!(doc).text;
    const ids = [...text.matchAll(/<mxCell id="([^"]*)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const back = asGraph((await DRAW_XML.read!(text)).document.pages[0]!);
    expect(back.data.edges.map((e) => e.endLabels)).toEqual([undefined, { to: 'a' }]);
  });

  it('numbers an edge whose own id another cell has', () => {
    const doc = docOf({ nodes: [{ id: 'a', lines: [], at: { x: 0, y: 0 }, width: 10, height: 10 }], edges: [{ id: 'a', from: 'a', to: 'a' }] });
    expect(DRAW_XML.write!(doc).text).toContain('<mxCell id="a-2"');
  });
});

import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from './document';
import { DIAGRAM_JSON } from './jsonFormat';
import { documentSpecs } from './toScene';

describe('DIAGRAM_JSON', () => {
  it('reads a page written before pages had kinds as a graph', () => {
    const text = JSON.stringify({
      format: 'weasel-diagram', version: 1,
      pages: [{ id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a', lines: ['A'] }], edges: [] } }],
    });
    expect(DIAGRAM_JSON.read!(text)).toMatchObject({ document: { pages: [{ id: 'p', kind: 'graph' }] } });
  });

  it('round-trips a plot page', () => {
    const doc: DiagramDocument = {
      pages: [{ kind: 'plot', id: 'c', width: 300, height: 200, data: { kind: 'xychart', series: [{ kind: 'line', values: [1, 2] }] } }],
    };
    expect(DIAGRAM_JSON.kinds).toContain('plot');
    expect(DIAGRAM_JSON.read!(DIAGRAM_JSON.write!(doc).text)).toEqual({ document: doc, warnings: [] });
  });

  it('lays out a page whose layout names an Object.prototype key as it does one of an unknown name', async () => {
    for (const name of ['toString', 'constructor', 'hasOwnProperty']) {
      const text = JSON.stringify({
        format: 'weasel-diagram', version: 1,
        pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, layout: { name }, data: { nodes: [{ id: 'a', lines: ['A'] }, { id: 'b', lines: ['B'] }], edges: [{ from: 'a', to: 'b' }] } }],
      });
      const { document } = await DIAGRAM_JSON.read!(text);
      expect(() => documentSpecs(document)).not.toThrow();
    }
  });
});

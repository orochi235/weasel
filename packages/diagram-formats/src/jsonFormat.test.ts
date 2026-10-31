import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from './document';
import { DIAGRAM_JSON } from './jsonFormat';

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
});

import { describe, expect, it } from 'vitest';
import { DIAGRAM_THEMES } from '@weasel-js/diagram';
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

  it('refuses a document whose theme object is not a whole theme, and reads a whole one', () => {
    const page = { kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [], edges: [] } };
    const text = (theme: unknown) => JSON.stringify({ format: 'weasel-diagram', version: 1, theme, pages: [page] });
    expect(() => DIAGRAM_JSON.read!(text({ roles: {} }))).toThrow(/theme does not check: .*roles: missing/);
    expect(() => DIAGRAM_JSON.read!(text(7))).toThrow(/theme does not check/);
    expect(DIAGRAM_JSON.read!(text(DIAGRAM_THEMES.paper))).toMatchObject({ document: { theme: DIAGRAM_THEMES.paper } });
    expect(DIAGRAM_JSON.read!(text('no-such-theme'))).toMatchObject({ document: { theme: 'no-such-theme' } });
  });
});

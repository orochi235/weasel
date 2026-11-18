import { describe, expect, it } from 'vitest';
import { DIAGRAM_THEMES } from '@weasel-js/diagram';
import type { DiagramDocument, DocumentPage, ImportResult } from './document';
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

  it('reads a version 1 graph page, written with groups, to the document version 2 writes', () => {
    const page = (data: object, grid: object) => ({ kind: 'graph', id: 'p', width: 400, height: 300, layout: { name: 'grid', options: { grid } }, data });
    const nodes = [{ id: 'a', lines: ['A'] }, { id: 'b', lines: ['B'] }];
    const v1 = JSON.stringify({
      format: 'weasel-diagram', version: 1,
      pages: [page({ nodes, edges: [], groups: [{ id: 'G', members: ['a', 'b'], label: 'G' }] }, { columns: 1, groupColumns: { G: 2 } })],
    });
    const doc: DiagramDocument = {
      pages: [page({ nodes, edges: [], clusters: [{ id: 'G', members: ['a', 'b'], label: 'G' }] }, { columns: 1, clusterColumns: { G: 2 } }) as DocumentPage],
    };
    const written = DIAGRAM_JSON.write!(doc).text;
    expect(JSON.parse(written)).toMatchObject({ version: 2 });
    expect(DIAGRAM_JSON.read!(v1)).toEqual(DIAGRAM_JSON.read!(written));
    const specs = documentSpecs((DIAGRAM_JSON.read!(v1) as ImportResult).document);
    expect(specs.specs.some((s) => s.id === 'G')).toBe(true);
    expect(specs).toEqual(documentSpecs(doc));
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

import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import { docOf } from '../pbt.fixture';
import type { DiagramDocument, GraphPage, ImportResult } from '../document';
import { DIAGRAM_MERMAID } from './format';

const write = (doc: DiagramDocument) => DIAGRAM_MERMAID.write!(doc).text;
const page = (text: string) => (DIAGRAM_MERMAID.read!(text) as ImportResult).document.pages[0] as GraphPage;
const back = (data: DiagramData, notation?: string) => page(write(docOf(data, notation !== undefined ? { notation } : {})));
const lines = (p: GraphPage) => p.data.nodes.map((n) => n.lines);

describe('Mermaid, shrunk counterexamples', () => {
  it('keeps an ampersand before text it spells as an entity', () => {
    expect(lines(back({ nodes: [{ id: 'a', lines: ['&&lt;'] }, { id: 'b', lines: ['&#'] }], edges: [] }))).toEqual([['&&lt;'], ['&#']]);
    expect(lines(back({ nodes: [{ id: 'a', lines: [] }, { id: 'b', lines: ['&&]'] }], edges: [] }, 'architecture'))[1]).toEqual(['&&]']);
    expect(back({ nodes: [{ id: 'a', lines: ['&('] }], edges: [] }, 'mindmap').data.nodes[0]!.lines).toEqual(['&(']);
  });

  it('reads a composite state\'s title back as the text it was written from', () => {
    const data: DiagramData = { nodes: [{ id: 'a', lines: [] }], edges: [], containers: [{ id: 'a_', role: 'container', label: '&amp;', members: ['a'] }] };
    expect(back(data, 'state').data.containers![0]!.label).toBe('&amp;');
  });

  it('writes an architecture title as text, not markup', () => {
    expect(lines(back({ nodes: [{ id: 'a', lines: [] }, { id: 'b', lines: ['<br>', 'a'] }], edges: [] }, 'architecture'))[1]).toEqual(['<br> a']);
  });

  it('drops, with a warning, an ER row that would not read as an attribute', () => {
    const doc = docOf({ nodes: [{ id: 'end', lines: ['', 'a', 'int id PK'] }], edges: [] }, { notation: 'er' });
    expect(DIAGRAM_MERMAID.write!(doc).warnings).toContain('Mermaid ER attributes are a type, a name, keys, and a quoted comment; rows that are not were dropped.');
    expect(page(write(doc)).data.nodes[0]!.rows!.flatMap((r) => (r.kind === 'field' ? [`${r.label} ${r.value}`] : []))).toEqual(['int id PK']);
  });

  it('drops, with a warning, a class member that would close the class or read as nothing', () => {
    const data: DiagramData = { nodes: [{ id: 'w', lines: ['', '}'] }, { id: 'd', lines: [] }], edges: [],
      containers: [{ id: 'j', role: 'container', members: ['w', 'd'] }] };
    expect(back(data, 'class').data.nodes.map((n) => n.id)).toEqual(['w', 'd']);
  });

  it('drops a blank line past a state\'s name rather than writing a description it cannot read', () => {
    expect(back({ nodes: [{ id: 'ly', lines: ['', ''] }], edges: [] }, 'state').data.nodes.map((n) => n.id)).toEqual(['ly']);
  });

  it('keeps a mind map node whose text is blank, a comment, or indented, and the nodes under it', () => {
    const data: DiagramData = {
      nodes: [{ id: 'r', lines: ['\t', ''] }, { id: 'b', lines: ['%%x'] }, { id: 'c', lines: [':::k'] }], edges: [{ from: 'r', to: 'b' }, { from: 'b', to: 'c' }],
    };
    expect(lines(back(data, 'mindmap'))).toEqual([[], ['%%x'], [':::k']]);
  });

  it('writes a mind map id that is not a plain name as one, and its brackets as text', () => {
    const p = back({ nodes: [{ id: 'a b', lines: ['(x)'], outline: 'roundRect' }], edges: [] }, 'mindmap');
    expect(p.data.nodes.map((n) => [n.id, n.lines, n.outline])).toEqual([['a_b', ['(x)'], 'roundRect']]);
  });

  it('reads a block\'s quoted text holding the other closer of its brackets', () => {
    const p = back({ nodes: [{ id: 'a', lines: ['/]'], outline: 'trapezoid' }], edges: [] }, 'block');
    expect(p.data.nodes.map((n) => [n.lines, n.outline])).toEqual([[['/]'], 'trapezoid']]);
    expect(page('block-beta\n  a[/"x"\\] b[/y/]').data.nodes.map((n) => n.outline)).toEqual(['trapezoid', 'parallelogram']);
  });

  it('keeps mind map text whose lines, trimmed, open and close with a backtick', () => {
    expect(back({ nodes: [{ id: 'a', lines: ['`', '` '] }], edges: [] }, 'mindmap').data.nodes[0]!.lines).toEqual(['`', '`']);
  });
});

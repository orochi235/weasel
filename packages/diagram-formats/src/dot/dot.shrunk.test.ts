import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from '../testing/asGraph';
import { docOf } from '../pbt.fixture';
import { DIAGRAM_DOT } from './format';
import { readDot } from './read';
import { writeDot } from './write';

const back = (data: DiagramData) => asGraph(readDot(writeDot(docOf(data)).text).document.pages[0]!);

describe('DOT, shrunk counterexamples', () => {
  it('keeps a label whose last line is empty', () => {
    expect(back({ nodes: [{ id: 'p', lines: ['', ''] }, { id: 'q', lines: ['a', ''] }], edges: [] }).data.nodes.map((n) => n.lines))
      .toEqual([['', ''], ['a', '']]);
  });

  it('quotes an id holding a no-break space, which the reader reads as a space', () => {
    expect(writeDot(docOf({ nodes: [{ id: ' ', lines: [] }], edges: [] })).text).toContain('" " [');
    expect(back({ nodes: [{ id: ' ', lines: [] }, { id: 'a', lines: [] }], edges: [] }).data.nodes.map((n) => n.id)).toEqual([' ', 'a']);
  });

  it('detects a graph whose quoted name holds a comment marker', () => {
    expect(DIAGRAM_DOT.detect(writeDot(docOf({ nodes: [{ id: 'a', lines: [] }], edges: [] }, { name: '//' })).text)).toBe(true);
    expect(DIAGRAM_DOT.detect('digraph "http://x/*y" {\n}\n')).toBe(true);
    expect(DIAGRAM_DOT.detect('// digraph {\n')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from '../testing/asGraph';
import { docOf } from '../pbt.fixture';
import type { ImportResult } from '../document';
import { DIAGRAM_MERMAID } from './format';

const back = (data: DiagramData, notation?: string) => {
  const text = DIAGRAM_MERMAID.write!(docOf(data, notation !== undefined ? { notation } : {})).text;
  return asGraph((DIAGRAM_MERMAID.read!(text) as ImportResult).document.pages[0]!).data;
};

describe('Mermaid graph kinds, line breaks, shrunk counterexamples', () => {
  it('reads back a class diagram\'s end label that is a line break', () => {
    const data: DiagramData = { nodes: [{ id: 'a', lines: [] }], edges: [{ from: 'a', to: 'a', endLabels: { to: '\n' } }] };
    expect(back(data, 'class').edges[0]!.endLabels).toEqual({ to: '\n' });
  });

  it('keeps an "&" before a line break in a name, in every kind that quotes it (10,000 runs)', () => {
    for (const notation of ['class', 'state', 'er', 'c4-context']) {
      expect(JSON.stringify(back({ nodes: [{ id: 'a', lines: ['&&\n', 'b'] }], edges: [] }, notation).nodes[0]), notation).toContain('&&');
    }
  });

  it('keeps a "#…;" typed in a class diagram\'s labels, and reads its edge labels\' entities (10,000 runs)', () => {
    const data: DiagramData = { nodes: [{ id: 'a', lines: [] }], edges: [{ from: 'a', to: 'a', label: 'x\n#35;', endLabels: { to: '#35;0;' } }] };
    expect(back(data, 'class').edges[0]).toMatchObject({ label: 'x\n#35;', endLabels: { to: '#35;0;' } });
  });

  it('writes a class member that breaks across lines on one line, where a "}" after the break closed the class (10,000 runs)', () => {
    expect(back({ nodes: [{ id: 'a', lines: ['', 'a\n}'] }, { id: 'b', lines: [] }], edges: [] }, 'class').nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('reads a state transition whose label holds a line separator', () => {
    const data: DiagramData = { nodes: [{ id: 'a', lines: [] }], edges: [{ from: 'a', to: 'a', label: 'x\u2028y' }] };
    expect(back(data, 'state').edges[0]!.label).toBe('x\u2028y');
  });

  it('writes an ER attribute row that breaks across lines as one line', () => {
    expect(back({ nodes: [{ id: 'aa', lines: ['', 'int\nn'] }], edges: [] }, 'er').nodes[0]!.rows).toContainEqual(expect.objectContaining({ kind: 'field' }));
  });

  it('writes a requirement named across lines as one line', () => {
    expect(back({ nodes: [{ id: 'a', lines: ['end\nend'] }], edges: [] }, 'requirement').nodes.map((n) => n.id)).toEqual(['end end']);
  });

  it('reads a title that opens with a line break the same once written again', () => {
    for (const notation of [undefined, 'architecture']) {
      const data: DiagramData = { nodes: [{ id: 'a', lines: ['\n', 'a'] }], edges: [], containers: [{ id: 'g', role: 'container', label: 'b\n', members: ['a'] }] };
      const once = back(data, notation);
      expect(back(once, notation)).toEqual(once);
      expect(once.containers![0]!.label).toBe('b');
    }
  });
});

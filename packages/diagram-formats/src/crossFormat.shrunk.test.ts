import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from './testing/asGraph';
import { docOf } from './pbt.fixture';
import { DIAGRAM_DOT } from './dot/format';
import { DIAGRAM_MERMAID } from './mermaid/format';
import type { ImportResult } from './document';

describe('formats across formats, shrunk counterexamples', () => {
  it('writes the nodes of containers that hold each other, and warns of the loop', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['a'] }], edges: [],
      containers: [{ id: 'c1', role: 'container', members: ['c2'] }, { id: 'c2', role: 'container', members: ['c1', 'a'] }],
    };
    for (const format of [DIAGRAM_DOT, DIAGRAM_MERMAID]) {
      const { text, warnings } = format.write!(docOf(data));
      expect(asGraph((format.read!(text) as ImportResult).document.pages[0]!).data.nodes.map((n) => n.id)).toEqual(['a']);
      expect(warnings.some((w) => w.includes('in a loop'))).toBe(true);
    }
  });
});

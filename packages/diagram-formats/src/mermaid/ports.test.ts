import { describe, expect, it } from 'vitest';
import type { DataEdge } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult } from '../document';
import { writeArchitecture } from './architecture/write';
import { writeBlockDiagram } from './block/write';
import { writeC4 } from './c4/write';
import { writeClassDiagram } from './class/write';
import { writeErDiagram } from './er/write';
import { writeFlowchart } from './flowchart/write';

const doc = (edge: Partial<DataEdge>): DiagramDocument => ({
  pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }], edges: [{ from: 'a', to: 'b', ...edge }] } }],
});

const DROPPED = 'Mermaid has no ports; connectors\' ports were dropped.';

describe('a connector port a Mermaid kind cannot hold', () => {
  const writers: [string, (d: DiagramDocument) => ExportResult, string][] = [
    ['flowchart', writeFlowchart, DROPPED],
    ['block', writeBlockDiagram, DROPPED],
    ['class', writeClassDiagram, DROPPED],
    ['ER', writeErDiagram, DROPPED],
    ['C4', writeC4, 'Mermaid C4 relationships run up, down, left or right, from one side to the opposite; other ports were dropped.'],
    ['architecture', writeArchitecture, 'Mermaid architecture edges meet a service on its n, s, e or w side; other ports were written as its right or left.'],
  ];
  for (const [kind, write, message] of writers) {
    it(`is dropped by the ${kind} writer with a warning`, () => {
      expect(write(doc({ fromPort: 'ne', toPort: 'sw' })).warnings).toContain(message);
      expect(write(doc({})).warnings).not.toContain(message);
    });
  }

  it('is not warned of where the kind holds it', () => {
    expect(writeArchitecture(doc({ fromPort: 'n', toPort: 's' })).warnings).toEqual([]);
    expect(writeC4(doc({ fromPort: 'e', toPort: 'w' })).warnings).not.toContain(writers[4]![2]);
  });
});

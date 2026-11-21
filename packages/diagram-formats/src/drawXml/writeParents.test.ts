import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { DIAGRAM_DRAW_XML } from './format';
import { asGraph } from '../testing/asGraph';

const docOf = (data: DiagramData): DiagramDocument => ({ pages: [{ kind: 'graph', id: 'p', width: 600, height: 400, data }], theme: 'paper' });
const parentOf = (text: string, id: string): string | null =>
  [...new DOMParser().parseFromString(text, 'application/xml').getElementsByTagName('mxCell')].find((c) => c.getAttribute('id') === id)!.getAttribute('parent');

describe('which cell holds each item in written draw-style XML', () => {
  it('writes a node a pool and its lane both name inside the lane, and keeps it there on read', async () => {
    const { text } = DIAGRAM_DRAW_XML.write!(docOf({
      nodes: [{ id: 'n', lines: ['N'], at: { x: 100, y: 60 } }, { id: 'f', lines: ['F'], at: { x: 500, y: 300 } }],
      edges: [],
      containers: [{
        id: 'pool', role: 'pool', axis: 'y', box: { x: 20, y: 20, width: 400, height: 200 },
        members: ['n', 'f'], lanes: [{ id: 'L', members: ['n'] }],
      }],
    }));
    expect(parentOf(text, 'n')).toBe('L');
    expect(parentOf(text, 'f')).not.toBe('pool');
    const pool = asGraph((await DIAGRAM_DRAW_XML.read!(text)).document.pages[0]!).data.containers!.find((c) => c.id === 'pool')!;
    expect(pool).toMatchObject({ lanes: [{ id: 'L', members: ['n'] }] });
  });

  it('leaves a container a group names outside the group, as the diagram draws it', () => {
    const { text } = DIAGRAM_DRAW_XML.write!(docOf({
      nodes: [{ id: 'n', lines: ['N'], at: { x: 400, y: 60 } }],
      edges: [],
      containers: [{ id: 'c', role: 'container', box: { x: 20, y: 20, width: 200, height: 120 } }],
      clusters: [{ id: 'g', members: ['n', 'c'] }],
    }));
    expect(parentOf(text, 'c')).not.toBe('g');
    expect(parentOf(text, 'n')).toBe('g');
  });
});

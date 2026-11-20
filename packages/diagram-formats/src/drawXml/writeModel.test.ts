import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { DIAGRAM_DRAW_XML } from './format';
import { parseStyle } from './style';
import { asGraph } from '../testing/asGraph';

const docOf = (data: DiagramData): DiagramDocument => ({ pages: [{ kind: 'graph', id: 'p', width: 800, height: 600, data }] });
const written = (data: DiagramData) => DIAGRAM_DRAW_XML.write!(docOf(data));
const cellsOf = (text: string) => new Map([...new DOMParser().parseFromString(text, 'application/xml').getElementsByTagName('mxCell')]
  .map((c) => [c.getAttribute('id')!, c]));
const back = async (data: DiagramData) => asGraph((await DIAGRAM_DRAW_XML.read!(written(data).text)).document.pages[0]!).data;

describe('writing groups', () => {
  it('writes a cluster\'s label as its group cell\'s value, and reads it back', async () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['A'], at: { x: 20, y: 20 } }, { id: 'b', lines: ['B'], at: { x: 200, y: 20 } }],
      edges: [], clusters: [{ id: 'g', members: ['a', 'b'], label: 'Team' }],
    };
    expect(cellsOf(written(data).text).get('g')!.getAttribute('value')).toBe('Team');
    expect((await back(data)).clusters).toEqual([{ id: 'g', members: ['a', 'b'], label: 'Team' }]);
  });
});

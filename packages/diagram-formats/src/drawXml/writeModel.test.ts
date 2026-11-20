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

describe('writing regions', () => {
  it('writes the members of a container\'s lanes, which only a pool draws, on the page', async () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['A'], at: { x: 20, y: 20 } }, { id: 'b', lines: ['B'], at: { x: 200, y: 20 } }],
      edges: [{ id: 'ab', from: 'a', to: 'b' }],
      containers: [{ id: 'k', role: 'container', box: { x: 0, y: 200, width: 200, height: 100 }, lanes: [{ id: 'l', members: ['a'] }] }],
    };
    const { text, warnings } = written(data);
    const cells = cellsOf(text);
    expect([cells.has('a'), cells.has('ab')]).toEqual([true, true]);
    expect(warnings).toEqual([]);
  });

  it('fills a container\'s and a pool\'s body, which a draw app fills from swimlaneFillColor, and reads the fill back', async () => {
    const data: DiagramData = {
      nodes: [], edges: [],
      containers: [
        { id: 'k', role: 'container', box: { x: 0, y: 0, width: 200, height: 100 }, colors: { fill: '#ffeeaa' } },
        { id: 'p', role: 'pool', axis: 'y', box: { x: 0, y: 200, width: 400, height: 200 }, colors: { fill: '#aaeeff' }, lanes: [{ id: 'l' }] },
      ],
    };
    const cells = cellsOf(written(data).text);
    const style = (id: string) => parseStyle(cells.get(id)!.getAttribute('style'));
    expect(style('k').values.get('swimlaneFillColor')).toBe('#ffeeaa');
    expect(style('p').values.get('swimlaneFillColor')).toBe('#aaeeff');
    expect(style('l').values.get('swimlaneFillColor')).toBe('none');
    const regions = new Map((await back(data)).containers!.map((c) => [c.id, c]));
    expect(regions.get('k')!.colors!.fill).toBe('#ffeeaa');
    expect(regions.get('p')!.colors!.fill).toBe('#aaeeff');
  });
});

import { describe, expect, it } from 'vitest';
import type { DataEdge } from '@weasel-js/diagram';
import { DIAGRAM_DRAW_XML } from './format';
import { asGraph } from '../testing/asGraph';

const read = (cells: string) => Promise.resolve(DIAGRAM_DRAW_XML.read!(
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`,
));
const page = async (cells: string) => {
  const { document, warnings } = await read(cells);
  return { data: asGraph(document.pages[0]!).data, warnings };
};
const box = (id: string, x: number, y: number, style = '', parent = '1') =>
  `<mxCell id="${id}" value="${id}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="40" height="20" as="geometry"/></mxCell>`;
const edge = (id: string, style: string, inner = '') =>
  `<mxCell id="${id}" style="${style}" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>${inner}`;

describe('reading labels', () => {
  it('keeps the line breaks of a connector, container, pool and lane label, as the writer keeps them', async () => {
    const doc = { pages: [{ kind: 'graph' as const, id: 'p', width: 600, height: 600, data: {
      nodes: [{ id: 'a', lines: ['A'], at: { x: 20, y: 20 } }, { id: 'b', lines: ['B'], at: { x: 300, y: 20 } }],
      edges: [{ id: 'e', from: 'a', to: 'b', label: 'yes\n(90%)' }],
      containers: [
        { id: 'k', role: 'container' as const, label: 'Billing\nTeam', box: { x: 0, y: 200, width: 200, height: 100 } },
        { id: 'p', role: 'pool' as const, axis: 'y' as const, label: 'Pool\nOne', box: { x: 0, y: 320, width: 400, height: 200 },
          lanes: [{ id: 'l', label: 'Lane\nOne' }] },
      ],
    } }] };
    const back = asGraph((await DIAGRAM_DRAW_XML.read!(DIAGRAM_DRAW_XML.write!(doc).text)).document.pages[0]!).data;
    expect(back.edges[0]!.label).toBe('yes\n(90%)');
    const regions = new Map(back.containers!.map((c) => [c.id, c]));
    expect(regions.get('k')!.label).toBe('Billing\nTeam');
    expect(regions.get('p')!.label).toBe('Pool\nOne');
    expect(regions.get('p')!.lanes![0]!.label).toBe('Lane\nOne');
  });
});

describe('reading connectors', () => {
  it('reads every draw-app edge style that routes at right angles as orthogonal', async () => {
    const styles = ['segmentEdgeStyle', 'sideToSideEdgeStyle', 'topToBottomEdgeStyle', 'elbowEdgeStyle'];
    const { data } = await page(box('a', 0, 0) + box('b', 200, 100) + styles.map((s) => edge(s, `edgeStyle=${s};`)).join(''));
    expect(data.edges.map((e: DataEdge) => e.router)).toEqual(styles.map(() => 'orthogonal'));
  });
});

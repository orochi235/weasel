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

  it('keeps the first of two labels at one end, with the warning extra mid labels get', async () => {
    const label = (id: string, value: string) =>
      `<mxCell id="${id}" value="${value}" style="edgeLabel;" vertex="1" parent="e"><mxGeometry x="-1" relative="1" as="geometry"/></mxCell>`;
    const { data, warnings } = await page(box('a', 0, 0) + box('b', 200, 100) + edge('e', '', label('l1', 'first') + label('l2', 'second')));
    expect(data.edges[0]!.endLabels).toEqual({ from: 'first' });
    expect(warnings).toContain('Connectors with more than one label at an end kept only the first.');
  });
});

describe('reading groups', () => {
  it('warns of a group holding only containers, and of a connector ending on it', async () => {
    const lane = (id: string, x: number) =>
      `<mxCell id="${id}" value="${id}" style="swimlane;" vertex="1" parent="g"><mxGeometry x="${x}" y="0" width="100" height="80" as="geometry"/></mxCell>`;
    const { data, warnings } = await page(`<mxCell id="g" style="group;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="300" height="80" as="geometry"/></mxCell>`
      + lane('c1', 0) + lane('c2', 150) + box('a', 0, 200)
      + `<mxCell id="e" edge="1" parent="1" source="a" target="g"><mxGeometry relative="1" as="geometry"/></mxCell>`);
    expect(data.clusters).toBeUndefined();
    expect(data.edges).toEqual([]);
    expect(warnings).toContain('Groups holding no shape were dropped.');
    expect(warnings).toContain('Connectors ending on a dropped group were left out.');
    expect(warnings).not.toContain('Connectors with a loose end, or with an end on another connector, were left out.');
  });
});

describe('naming cells across pages', () => {
  it('leaves the ids of cells a page dropped free for a later page', async () => {
    const model = (cells: string) => `<diagram id="p%"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram>`;
    const first = model(box('a', 0, 0) + `<mxCell id="g" style="group;" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell>`
      + `<mxCell id="e" edge="1" parent="1" source="a"><mxGeometry relative="1" as="geometry"/></mxCell>`).replace('%', '1');
    const second = model(box('g', 0, 0) + box('e', 100, 0)).replace('%', '2');
    const { document } = await DIAGRAM_DRAW_XML.read!(`<mxfile>${first}${second}</mxfile>`);
    expect(asGraph(document.pages[1]!).data.nodes.map((n) => n.id)).toEqual(['g', 'e']);
  });
});

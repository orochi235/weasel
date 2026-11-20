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

describe('reading connectors', () => {
  it('reads every draw-app edge style that routes at right angles as orthogonal', async () => {
    const styles = ['segmentEdgeStyle', 'sideToSideEdgeStyle', 'topToBottomEdgeStyle', 'elbowEdgeStyle'];
    const { data } = await page(box('a', 0, 0) + box('b', 200, 100) + styles.map((s) => edge(s, `edgeStyle=${s};`)).join(''));
    expect(data.edges.map((e: DataEdge) => e.router)).toEqual(styles.map(() => 'orthogonal'));
  });
});

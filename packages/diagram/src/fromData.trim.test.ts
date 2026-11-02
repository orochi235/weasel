import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf, type DataEdge, type DiagramData } from './fromData';
import { themeEdgeStroke } from './theme/resolve';
import { DIAGRAM_THEMES } from './theme/themes';

const NODES: DiagramData['nodes'] = [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }];

const edgeStroke = (edge: DataEdge, opts?: Parameters<typeof diagramScene>[1]) =>
  diagramScene({ nodes: NODES, edges: [edge] }, opts).find((s) => s.id === edgeIdOf(edge))?.data?.stroke;

describe('diagramScene edge trim', () => {
  it("passes an edge style's trim to the edge's stroke", () => {
    const edge: DataEdge = { from: 'a', to: 'b' };
    expect(edgeStroke(edge, { edgeStyle: () => ({ stroke: '#333', trim: { end: 0.5 } }) })?.trim).toEqual({ end: 0.5 });
  });

  it("passes an edge's own trim from its colors", () => {
    const edge: DataEdge = { from: 'a', to: 'b', colors: { trim: { start: { length: 4 }, pace: 'anchor' } } };
    expect(edgeStroke(edge)?.trim).toEqual({ start: { length: 4 }, pace: 'anchor' });
  });

  it('leaves the stroke untrimmed without one', () => {
    const stroke = edgeStroke({ from: 'a', to: 'b' });
    expect(stroke).toBeDefined();
    expect(stroke).not.toHaveProperty('trim');
  });

  it("starts a new connector with the theme's trim, as diagramScene draws its edges", () => {
    const theme = { ...DIAGRAM_THEMES.paper!, edge: { ...DIAGRAM_THEMES.paper!.edge, trim: { end: 0.25 } } };
    expect(themeEdgeStroke(theme).trim).toEqual({ end: 0.25 });
    expect(edgeStroke({ from: 'a', to: 'b' }, { theme })?.trim).toEqual({ end: 0.25 });
  });
});

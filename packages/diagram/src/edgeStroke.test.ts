import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf, type DataEdge } from './fromData';
import { EDGE_STROKE_WIDTH } from './dataTypes';
import { themeEdgeStroke } from './theme/resolve';
import { DEFAULT_EDGE_STROKE } from './connect';
import { DIAGRAM_THEMES } from './theme/themes';

const { width: _, ...unsized } = DIAGRAM_THEMES.paper!.edge;
const THEME = { ...DIAGRAM_THEMES.paper!, edge: { ...unsized, dash: [4, 2], markerStart: 'circle' as const } };

describe('edge strokes', () => {
  it('give an edge whose style sets no width EDGE_STROKE_WIDTH, from a connector and from diagramScene alike', () => {
    const edge: DataEdge = { from: 'a', to: 'b' };
    const drawn = diagramScene({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [edge] }, { theme: THEME })
      .find((s) => s.id === edgeIdOf(edge))?.data?.stroke;
    expect(themeEdgeStroke(THEME).width).toBe(EDGE_STROKE_WIDTH);
    expect(drawn).toEqual(themeEdgeStroke(THEME));
  });

  it('give a connect-authored edge with no stroke of its own what diagramScene draws with no theme', () => {
    const edge: DataEdge = { from: 'a', to: 'b' };
    const drawn = diagramScene({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [edge] }).find((s) => s.id === edgeIdOf(edge))?.data?.stroke;
    expect(DEFAULT_EDGE_STROKE).toEqual(drawn);
  });
});

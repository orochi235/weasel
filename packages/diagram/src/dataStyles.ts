/**
 * The style each item of a `DiagramData` is drawn in: its own colors over its
 * theme role's, over the theme's defaults. `diagramScene` draws with these, and
 * a format writing a document's colors out reads them the same way.
 */
import { withColors } from './dataColors';
import { NODE, type DataContainer, type DataEdge, type DataNode, type EdgeStyle, type NodeStyle } from './dataTypes';
import { roleEdgeStyle, roleStyle } from './theme/resolve';
import type { DiagramTheme } from './theme/types';

/** What an edge is drawn with when there is no theme and nothing says otherwise. */
export const EDGE: EdgeStyle = { stroke: '#7ba7c7' };

/** A node's style: its colors over its role's under `theme`, else over {@link NODE}. */
export function dataNodeStyle(node: Pick<DataNode, 'style' | 'colors'>, theme?: DiagramTheme): NodeStyle {
  return withColors(theme ? roleStyle(theme, node.style) : NODE, node.colors);
}

/** An edge's style: its colors over its role's stroke under `theme`, else over the theme's connector, else over {@link EDGE}. */
export function dataEdgeStyle(edge: Pick<DataEdge, 'style' | 'colors'>, theme?: DiagramTheme): EdgeStyle {
  return withColors(theme ? roleEdgeStyle(theme, edge.style) : EDGE, edge.colors);
}

/** A region as {@link dataRegionStyle} reads it: a container, a pool, or a lane. */
export interface StyledRegion {
  role: DataContainer['role'] | 'lane';
  style?: string;
  colors?: Partial<NodeStyle>;
}

/**
 * A region's style: its colors over its theme role's, else over the theme's
 * container, its pool header, or the lane body at `laneIndex` in turn; with no
 * theme, over {@link NODE}.
 */
export function dataRegionStyle(region: StyledRegion, theme?: DiagramTheme, laneIndex = 0): NodeStyle {
  return withColors(themeRegionStyle(region, theme, laneIndex), region.colors);
}

function themeRegionStyle(r: StyledRegion, theme: DiagramTheme | undefined, laneIndex: number): NodeStyle {
  if (theme === undefined) return NODE;
  const own = r.style !== undefined ? theme.roles[r.style] : undefined;
  if (own !== undefined) return own;
  if (r.role === 'pool') return theme.lane.header;
  if (r.role === 'lane') return theme.lane.bodies[laneIndex % Math.max(1, theme.lane.bodies.length)] ?? theme.container;
  return theme.container;
}

import { useTransformFollower, type Contribution, type RenderLayer, type SelectionApi, type Tool } from '@weasel-js/core';
import {
  CONNECTOR_TOOL_ID, FLOWCHART_STENCILS, diagramEdgeEnds, diagramPorts, diagramWaypoints, editEdgeLabelAction,
  editEdgeLabelBinding, registerDiagramShape, roleStyle, sceneParticipants, stencilKind, stencilTool,
  themeEdgeStroke, themeFont, themeLabelStyle, useConnectorTool, useStencilInsert, waypointFollower, type DiagramTheme,
} from '@weasel-js/diagram';
import { useCallback, useEffect, useMemo } from 'react';
import type { ChartPose, ChartScene } from './chartDocument';

const ROUTER = 'orthogonal';

/** Double-click an edge to label it, in the theme's label color and face. */
const edgeLabel = (theme: DiagramTheme): Contribution => ({
  id: 'weaselchart-edge-label',
  eligibility: { always: true },
  actions: [editEdgeLabelAction({ fill: theme.label.fill, style: themeLabelStyle(theme) })],
  bindings: [editEdgeLabelBinding()],
});

const STENCIL_TOOLS: Record<string, Tool> = Object.fromEntries(
  FLOWCHART_STENCILS.map((s) => [stencilKind(s.id), stencilTool(s)]),
);

export interface ChartDiagram {
  /** For `registerLayer`, in order: the last registered is hit first. */
  layers: readonly RenderLayer<unknown>[];
  ambient: readonly Contribution[];
  tools: Record<string, Tool>;
}

/** The diagram editing chart mode adds to its canvas: ports, route handles, edge ends, edge labels, the connector and the
 *  stencils. What it inserts is drawn in `theme`. */
export function useChartDiagram(scene: ChartScene, selection: SelectionApi, theme: DiagramTheme): ChartDiagram {
  useEffect(() => registerDiagramShape<ChartPose>(), []);
  const participants = useMemo(() => sceneParticipants<ChartPose>(scene), [scene]);
  const selected = useCallback(() => selection.get() as readonly string[], [selection]);
  const edgeStroke = useMemo(() => themeEdgeStroke(theme), [theme]);
  const ports = useMemo(
    () => diagramPorts<ChartPose>({ participants, bodies: true, router: ROUTER, edgeStroke }),
    [participants, edgeStroke],
  );
  const ends = useMemo(
    () => diagramEdgeEnds<ChartPose>({ selected, participants, bodies: true }),
    [selected, participants],
  );
  const route = useMemo(() => diagramWaypoints<ChartPose>({ selected, participants }), [selected, participants]);
  const connector = useConnectorTool<ChartPose>({ participants, router: ROUTER, edgeStroke });
  const label = useMemo(() => edgeLabel(theme), [theme]);
  return useMemo(() => ({
    // Edge ends last: an edge's end sits on a port and beside a route handle, and a press on it must start neither.
    layers: [ports.layer, route.layer, ends.layer],
    ambient: [ports.contribution, route.contribution, ends.contribution, label],
    tools: { [CONNECTOR_TOOL_ID]: connector, ...STENCIL_TOOLS },
  }), [ports, route, ends, connector, label]);
}

/**
 * Puts an `insert` dep that builds stencil bodies over the canvas's own, which still takes every
 * other kind. Mounted as a child of `<SceneCanvas>`: the newest source is the one asked first,
 * and a child registers after the canvas.
 */
export function StencilInsertPublisher({ theme }: { theme: DiagramTheme }): null {
  const opts = useMemo(() => ({ style: roleStyle(theme), font: themeFont(theme) }), [theme]);
  useStencilInsert(FLOWCHART_STENCILS, opts);
  return null;
}

/** Carries a connector's waypoints along when a move takes both its ends. Mounted as a child of `<SceneCanvas>`. */
export function WaypointFollowerPublisher({ scene }: { scene: ChartScene }): null {
  const follower = useMemo(() => waypointFollower<ChartPose>(scene), [scene]);
  useTransformFollower(() => follower);
  return null;
}

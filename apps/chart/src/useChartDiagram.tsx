import {
  useDepSource, useTransformFollower, type Contribution, type RenderLayer, type SelectionApi, type Tool,
} from '@weasel-js/core';
import {
  CONNECTOR_TOOL_ID, CONTAINER_STENCILS, FLOWCHART_STENCILS, diagramCanDropInto, diagramContainers, diagramEdgeEnds,
  diagramOffPage, diagramPorts, diagramWaypoints, editEdgeLabelAction, editEdgeLabelBinding, registerDiagramShape, roleStyle,
  sceneParticipants, stencilKind, stencilTool, themeEdgeStroke, themeFont, themeLabelStyle, useAvoidRouting, useHops,
  useLabelPlacement, rendererMeasure, useConnectorTool, useOffPageMarkers, useStencilInsert, waypointFollower, type DiagramTheme,
} from '@weasel-js/diagram';
import { useCallback, useEffect, useMemo } from 'react';
import type { ChartPose, ChartScene } from './chartDocument';
import { PAGE_FIT_PADDING } from './pages/useChartPages';
import { CHART_DEFAULT_THEME } from './theme/themeCommands';

/** New connectors route around shapes; saved ones keep the router they have. */
const ROUTER = 'avoid';

/** Double-click an edge to label it, in the theme's label color and face. */
const edgeLabel = (theme: DiagramTheme): Contribution => ({
  id: 'weaselchart-edge-label',
  eligibility: { always: true },
  actions: [editEdgeLabelAction({ fill: theme.label.fill, style: themeLabelStyle(theme) })],
  bindings: [editEdgeLabelBinding()],
});

/** Double-click an off-page tag to go to the other page. */
const OFF_PAGE = diagramOffPage({ padding: PAGE_FIT_PADDING }).contribution;

/** Labels sized by the renderer's own text metrics, as stencil rows are. */
const LABEL_PLACEMENT = { measure: rendererMeasure };

const STENCIL_TOOLS: Record<string, Tool> = Object.fromEntries(
  [...FLOWCHART_STENCILS, ...CONTAINER_STENCILS].map((s) => [stencilKind(s.id), stencilTool(s)]),
);

export interface ChartDiagram {
  /** For `registerLayer`, in order: the last registered is hit first. */
  layers: readonly RenderLayer<unknown>[];
  ambient: readonly Contribution[];
  tools: Record<string, Tool>;
}

/** The diagram editing chart mode adds to its canvas: ports, route handles, edge ends, edge labels and where they
 *  settle, lanes, off-page tags, the connector and the stencils. What it inserts is drawn in `theme`. */
export function useChartDiagram(scene: ChartScene, selection: SelectionApi, theme: DiagramTheme): ChartDiagram {
  useEffect(() => registerDiagramShape<ChartPose>(), []);
  useLabelPlacement<ChartPose>(scene as never, LABEL_PLACEMENT);
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
  const containers = useMemo(() => diagramContainers({ scene: scene as never, selected }), [scene, selected]);
  const connector = useConnectorTool<ChartPose>({ participants, router: ROUTER, edgeStroke });
  const label = useMemo(() => edgeLabel(theme), [theme]);
  useOffPageMarkers<ChartPose>(scene as never, { theme: CHART_DEFAULT_THEME });
  return useMemo(() => ({
    // Edge ends last: an edge's end sits on a port and beside a route handle, and a press on it must start neither.
    layers: [containers.layer, ports.layer, route.layer, ends.layer],
    ambient: [containers.contribution, ports.contribution, route.contribution, ends.contribution, label, OFF_PAGE],
    tools: { [CONNECTOR_TOOL_ID]: connector, ...STENCIL_TOOLS },
  }), [containers, ports, route, ends, connector, label]);
}

/**
 * Puts an `insert` dep that builds stencil bodies and containers over the canvas's own, which still takes every
 * other kind. Mounted as a child of `<SceneCanvas>`: the newest source is the one asked first,
 * and a child registers after the canvas.
 */
export function StencilInsertPublisher({ theme }: { theme: DiagramTheme }): null {
  const opts = useMemo(
    () => ({
      style: roleStyle(theme), font: themeFont(theme), measure: rendererMeasure,
      containers: CONTAINER_STENCILS, containerStyle: theme.container, laneStyles: theme.lane,
    }),
    [theme],
  );
  useStencilInsert(FLOWCHART_STENCILS, opts);
  return null;
}

/** Carries a connector's waypoints along when a move takes both its ends. Mounted as a child of `<SceneCanvas>`. */
export function WaypointFollowerPublisher({ scene }: { scene: ChartScene }): null {
  const follower = useMemo(() => waypointFollower<ChartPose>(scene), [scene]);
  useTransformFollower(() => follower);
  return null;
}

/** Routes `avoid` connectors around shapes on every edit, and live while a shape is dragged. Mounted as a child of `<SceneCanvas>`. */
export function AvoidRoutingPublisher({ scene }: { scene: ChartScene }): null {
  useAvoidRouting<ChartPose>(scene as never);
  return null;
}

/** Hops connectors over the ones they cross while Line jumps is on, and hides the hops a drag moves. Mounted as a child
 *  of `<SceneCanvas>`, after `AvoidRoutingPublisher`, so a drag's preview keeps the routes that one previews. */
export function HopsPublisher({ scene }: { scene: ChartScene }): null {
  useHops<ChartPose>(scene as never);
  return null;
}

/** Lets a drag drop shapes only into containers and lanes, and lanes only into pools. Mounted as a child of `<SceneCanvas>`. */
export function ContainerDropPublisher({ scene }: { scene: ChartScene }): null {
  const canDropInto = useMemo(() => diagramCanDropInto(scene), [scene]);
  useDepSource('canDropInto', () => canDropInto);
  return null;
}

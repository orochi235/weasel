import {
  useDepSource, useTransformFollower, type Contribution, type RenderLayer, type SelectionApi, type Tool,
} from '@weasel-js/core';
import {
  CONNECTOR_TOOL_ID, STENCIL_GROUPS, bodyFollower, diagramSequence, diagramCanDropInto, diagramTypeEdgeStroke, isContainerStencil, diagramContainers, diagramEdgeEnds,
  diagramLabelDrag, diagramOffPage, diagramPorts, diagramWaypoints, editEdgeLabelAction, editEdgeLabelBinding,
  registerDiagramShape, roleStyle, sceneParticipants, stencilKind, stencilTool, themeFont,
  themeLabelStyle, useAvoidRouting, useHops, useLabelPlacement, rendererMeasure, useConnectorTool, useOffPageMarkers,
  useStencilInsert, waypointFollower, type DiagramStencil, type DiagramTheme, type DiagramType,
} from '@weasel-js/diagram';
import { useCallback, useEffect, useMemo } from 'react';
import { useAutoLayoutCommand } from './autoLayout';
import type { ChartPose, ChartScene } from './chartDocument';
import { PAGE_FIT_PADDING } from './pages/useChartPages';
import { stencilDrop } from './stencilDrop';
import { CHART_DEFAULT_THEME } from './theme/themeCommands';

/** New connectors route around shapes unless the chart's type names a router; saved ones keep the router they have. */
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

/** Every shipped group's stencils, so a chart showing any group can draw it. */
const ALL_STENCILS = Object.values(STENCIL_GROUPS).flatMap((g) => g.stencils);
const SHAPE_STENCILS = ALL_STENCILS.filter((s): s is DiagramStencil => !isContainerStencil(s));
const CONTAINER_STENCILS = ALL_STENCILS.filter(isContainerStencil);

const STENCIL_TOOLS: Record<string, Tool> = Object.fromEntries(ALL_STENCILS.map((s) => [stencilKind(s.id), stencilTool(s)]));

export interface ChartDiagram {
  /** For `registerLayer`, in order: the last registered is hit first. */
  layers: readonly RenderLayer<unknown>[];
  ambient: readonly Contribution[];
  tools: Record<string, Tool>;
}

/** The diagram editing chart mode adds to its canvas: ports, route handles, edge ends, edge labels, where they
 *  settle and dragging them, lanes, off-page tags, the connector and the stencils, a stencil carried in from the
 *  Shapes panel, a sequence diagram's parts dragged, and Arrange › Auto layout. What it inserts is drawn in
 *  `theme`, its connectors as `type` starts them. */
export function useChartDiagram(scene: ChartScene, selection: SelectionApi, theme: DiagramTheme, type: DiagramType): ChartDiagram {
  useEffect(() => registerDiagramShape<ChartPose>(), []);
  useLabelPlacement<ChartPose>(scene as never, LABEL_PLACEMENT);
  const participants = useMemo(() => sceneParticipants<ChartPose>(scene), [scene]);
  const selected = useCallback(() => selection.get() as readonly string[], [selection]);
  const edgeStroke = useMemo(() => diagramTypeEdgeStroke(theme, type), [theme, type]);
  const router = type.edge?.router ?? ROUTER;
  useAutoLayoutCommand(scene, type, participants);
  const ports = useMemo(
    () => diagramPorts<ChartPose>({ participants, bodies: true, router, edgeStroke }),
    [participants, router, edgeStroke],
  );
  const ends = useMemo(
    () => diagramEdgeEnds<ChartPose>({ selected, participants, bodies: true }),
    [selected, participants],
  );
  const route = useMemo(() => diagramWaypoints<ChartPose>({ selected, participants }), [selected, participants]);
  const containers = useMemo(() => diagramContainers({ scene: scene as never, selected }), [scene, selected]);
  const labelDrag = useMemo(() => diagramLabelDrag({ scene: scene as never, selected }), [scene, selected]);
  const connector = useConnectorTool<ChartPose>({ participants, router, edgeStroke });
  const label = useMemo(() => edgeLabel(theme), [theme]);
  const drop = useMemo(() => stencilDrop(participants), [participants]);
  const sequence = useMemo(() => diagramSequence({ scene: scene as never, measure: rendererMeasure }), [scene]);
  useOffPageMarkers<ChartPose>(scene as never, { theme: CHART_DEFAULT_THEME });
  return useMemo(() => ({
    // Edge ends after ports and routes: an edge's end sits on a port and beside a route handle, and a press on it must start
    // neither. A sequence's parts last: nothing else takes a press on them.
    layers: [containers.layer, labelDrag.layer, ports.layer, route.layer, ends.layer, sequence.layer],
    ambient: [
      containers.contribution, labelDrag.contribution, ports.contribution, route.contribution, ends.contribution, label,
      OFF_PAGE, drop, sequence.contribution,
    ],
    tools: { [CONNECTOR_TOOL_ID]: connector, ...STENCIL_TOOLS },
  }), [containers, labelDrag, ports, route, ends, connector, label, drop, sequence]);
}

/**
 * Puts an `insert` dep that builds stencil bodies and containers over the canvas's own, which still takes every
 * other kind. Mounted as a child of `<SceneCanvas>`: the newest source is the one asked first,
 * and a child registers after the canvas.
 */
export function StencilInsertPublisher({ theme }: { theme: DiagramTheme }): null {
  const opts = useMemo(
    () => ({
      style: roleStyle(theme), theme, font: themeFont(theme), measure: rendererMeasure,
      containers: CONTAINER_STENCILS, containerStyle: theme.container, laneStyles: theme.lane,
    }),
    [theme],
  );
  useStencilInsert(SHAPE_STENCILS, opts);
  return null;
}

/** Carries a connector's waypoints along when a move takes both its ends. Mounted as a child of `<SceneCanvas>`. */
export function WaypointFollowerPublisher({ scene }: { scene: ChartScene }): null {
  const follower = useMemo(() => waypointFollower<ChartPose>(scene), [scene]);
  useTransformFollower(() => follower);
  return null;
}

/** Lays a resized shape's rows out again inside its new box. Mounted as a child of `<SceneCanvas>`. */
export function BodyFollowerPublisher({ scene }: { scene: ChartScene }): null {
  const follower = useMemo(() => bodyFollower<ChartPose>(scene), [scene]);
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

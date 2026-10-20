import {
  useDepSource, useTransformFollower, type Contribution, type RenderLayer, type SelectionApi, type Tool,
} from '@weasel-js/core';
import {
  CONNECTOR_TOOL_ID, CONTAINER_STENCILS, FLOWCHART_STENCILS, diagramCanDropInto, diagramContainers, diagramEdgeEnds,
  diagramPorts, diagramWaypoints, editEdgeLabelAction, editEdgeLabelBinding, registerDiagramShape, sceneParticipants,
  stencilKind, stencilTool, useConnectorTool, useStencilInsert, waypointFollower,
} from '@weasel-js/diagram';
import { useCallback, useEffect, useMemo } from 'react';
import { CHART_EDGE_STROKE, CHART_LABEL_FILL, CHART_NODE_STYLE, type ChartPose, type ChartScene } from './chartDocument';

const ROUTER = 'orthogonal';

const EDGE_LABEL: Contribution = {
  id: 'weaselchart-edge-label',
  eligibility: { always: true },
  actions: [editEdgeLabelAction({ fill: CHART_LABEL_FILL })],
  bindings: [editEdgeLabelBinding()],
};

const STENCIL_INSERT = { style: CHART_NODE_STYLE, containers: CONTAINER_STENCILS };

const STENCIL_TOOLS: Record<string, Tool> = Object.fromEntries(
  [...FLOWCHART_STENCILS, ...CONTAINER_STENCILS].map((s) => [stencilKind(s.id), stencilTool(s)]),
);

export interface ChartDiagram {
  /** For `registerLayer`, in order: the last registered is hit first. */
  layers: readonly RenderLayer<unknown>[];
  ambient: readonly Contribution[];
  tools: Record<string, Tool>;
}

/** The diagram editing chart mode adds to its canvas: ports, route handles, edge ends, edge labels, lanes, the connector and the stencils. */
export function useChartDiagram(scene: ChartScene, selection: SelectionApi): ChartDiagram {
  useEffect(() => registerDiagramShape<ChartPose>(), []);
  const participants = useMemo(() => sceneParticipants<ChartPose>(scene), [scene]);
  const selected = useCallback(() => selection.get() as readonly string[], [selection]);
  const ports = useMemo(
    () => diagramPorts<ChartPose>({ participants, bodies: true, router: ROUTER, edgeStroke: CHART_EDGE_STROKE }),
    [participants],
  );
  const ends = useMemo(
    () => diagramEdgeEnds<ChartPose>({ selected, participants, bodies: true }),
    [selected, participants],
  );
  const route = useMemo(() => diagramWaypoints<ChartPose>({ selected, participants }), [selected, participants]);
  const containers = useMemo(() => diagramContainers({ scene: scene as never, selected }), [scene, selected]);
  const connector = useConnectorTool<ChartPose>({ participants, router: ROUTER, edgeStroke: CHART_EDGE_STROKE });
  return useMemo(() => ({
    // Edge ends last: an edge's end sits on a port and beside a route handle, and a press on it must start neither.
    layers: [containers.layer, ports.layer, route.layer, ends.layer],
    ambient: [containers.contribution, ports.contribution, route.contribution, ends.contribution, EDGE_LABEL],
    tools: { [CONNECTOR_TOOL_ID]: connector, ...STENCIL_TOOLS },
  }), [containers, ports, route, ends, connector]);
}

/**
 * Puts an `insert` dep that builds stencil bodies and containers over the canvas's own, which still takes every
 * other kind. Mounted as a child of `<SceneCanvas>`: the newest source is the one asked first,
 * and a child registers after the canvas.
 */
export function StencilInsertPublisher(): null {
  useStencilInsert(FLOWCHART_STENCILS, STENCIL_INSERT);
  return null;
}

/** Carries a connector's waypoints along when a move takes both its ends. Mounted as a child of `<SceneCanvas>`. */
export function WaypointFollowerPublisher({ scene }: { scene: ChartScene }): null {
  const follower = useMemo(() => waypointFollower<ChartPose>(scene), [scene]);
  useTransformFollower(() => follower);
  return null;
}

/** Lets a drag drop shapes only into containers and lanes, and lanes only into pools. Mounted as a child of `<SceneCanvas>`. */
export function ContainerDropPublisher({ scene }: { scene: ChartScene }): null {
  const canDropInto = useMemo(() => diagramCanDropInto(scene), [scene]);
  useDepSource('canDropInto', () => canDropInto);
  return null;
}

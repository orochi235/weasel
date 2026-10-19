import type { Contribution, RenderLayer, SelectionApi, Tool } from '@weasel-js/core';
import {
  CONNECTOR_TOOL_ID, FLOWCHART_STENCILS, diagramEdgeEnds, diagramPorts, editEdgeLabelAction, editEdgeLabelBinding,
  registerDiagramShape, sceneParticipants, stencilKind, stencilTool, useConnectorTool, useStencilInsert,
} from '@weasel-js/diagram';
import { useCallback, useEffect, useMemo } from 'react';
import type { ChartPose, ChartScene } from './chartDocument';

const ROUTER = 'orthogonal';

const EDGE_LABEL: Contribution = {
  id: 'weaselchart-edge-label',
  eligibility: { always: true },
  actions: [editEdgeLabelAction()],
  bindings: [editEdgeLabelBinding()],
};

const STENCIL_TOOLS: Record<string, Tool> = Object.fromEntries(
  FLOWCHART_STENCILS.map((s) => [stencilKind(s.id), stencilTool(s)]),
);

export interface ChartDiagram {
  /** For `registerLayer`, in order: the last registered is hit first. */
  layers: readonly RenderLayer<unknown>[];
  ambient: readonly Contribution[];
  tools: Record<string, Tool>;
}

/** The diagram editing chart mode adds to its canvas: ports, edge ends, edge labels, the connector and the stencils. */
export function useChartDiagram(scene: ChartScene, selection: SelectionApi): ChartDiagram {
  useEffect(() => registerDiagramShape<ChartPose>(), []);
  const participants = useMemo(() => sceneParticipants<ChartPose>(scene), [scene]);
  const selected = useCallback(() => selection.get() as readonly string[], [selection]);
  const ports = useMemo(
    () => diagramPorts<ChartPose>({ participants, bodies: true, router: ROUTER }),
    [participants],
  );
  const ends = useMemo(
    () => diagramEdgeEnds<ChartPose>({ selected, participants, bodies: true }),
    [selected, participants],
  );
  const connector = useConnectorTool<ChartPose>({ participants, router: ROUTER });
  return useMemo(() => ({
    // Edge ends after ports: an edge's end sits on a port, and a press on its handle must not start a connect.
    layers: [ports.layer, ends.layer],
    ambient: [ports.contribution, ends.contribution, EDGE_LABEL],
    tools: { [CONNECTOR_TOOL_ID]: connector, ...STENCIL_TOOLS },
  }), [ports, ends, connector]);
}

/**
 * Replaces the canvas's `insert` dep with one that builds stencil bodies. Mounted as a child
 * of `<SceneCanvas>`: the dep registry is last-write-wins, and a child registers after the canvas.
 */
export function StencilInsertPublisher(): null {
  useStencilInsert(FLOWCHART_STENCILS);
  return null;
}

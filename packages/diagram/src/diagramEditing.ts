/**
 * What `DiagramView` installs for each editing callback it is handed. Every
 * action keeps its gesture and swaps its commit for one that reports a data
 * edit, so the host changes its data and the view follows through the specs.
 */
import {
  createDeleteAction,
  createResizeAction,
  dragPanContribution,
  useLatest,
  type Action,
  type ActionsProp,
  type Contribution,
  type RectPose,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import { useMemo } from 'react';
import { isBodyEnd } from './connectTargets';
import { diagramPorts, diagramWaypoints } from './contribution';
import { editEdgeLabelAction, editEdgeLabelBinding } from './edgeLabel';
import { diagramEdgeOf } from './edgeTrait';
import type { DiagramSpec } from './fromData';
import type { ParticipantSource } from './portAffordance';
import { portLayer } from './portLayer';
import { diagramEdgeEnds, type EndChange } from './reconnect';
import { groupReorderContribution } from './groupReorder';
import { dataKeyReader } from './trait';
import type { DeleteReport, DiagramViewProps, NodeResize, ReconnectChange } from './diagramViewProps';

const AMBIENT = [dragPanContribution()];
// A drag on empty canvas pans: the select tool's marquee would outrank the ambient pan.
const NO_MARQUEE = { areaSelect: null };

/**
 * The data a delete of `ids` takes: the selected nodes and groups, and every
 * edge selected or ending on one of them. Not `removalClosure`: a group
 * depends on its members, and deleting a member leaves the group standing.
 */
export function removedData(scene: Scene<unknown, string, unknown>, ids: readonly string[]): DeleteReport {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const id of ids) {
    const node = scene.get(id as never);
    if (node === undefined) continue;
    if (diagramEdgeOf(node) !== null) edges.add(id);
    else if (dataKeyReader(node) !== null) nodes.add(id);
  }
  for (const node of scene.renderOrderNodes()) {
    const ends = node.dependsOn;
    if (diagramEdgeOf(node) !== null && Array.isArray(ends) && ends.some((end) => nodes.has(end))) edges.add(node.id);
  }
  return { nodes: [...nodes], edges: [...edges] };
}

/** Core's `delete`, reporting what it would remove instead of removing it. */
export function reportDeleteAction(report: (removed: DeleteReport) => void): Action {
  return createDeleteAction({
    commit: (ids, deps) => {
      if (deps.scene === undefined) return;
      const removed = removedData(deps.scene as Scene<unknown, string, unknown>, ids);
      if (removed.nodes.length > 0 || removed.edges.length > 0) report(removed);
    },
  });
}

/** Core's `resize`, reporting the selected boxes it would leave instead of writing them. */
export function reportResizeAction(report: (resizes: readonly NodeResize[]) => void): Action {
  return createResizeAction({
    commit: (poses, deps) => {
      const picked = new Set(deps.selection?.get() ?? []);
      const resizes: NodeResize[] = [];
      for (const [id, pose] of poses) {
        if (!picked.has(id)) continue;
        const { x, y, width, height } = pose as RectPose;
        resizes.push({ id, x, y, width, height });
      }
      if (resizes.length > 0) report(resizes);
    },
  });
}

export const reconnectChangeOf =({ edgeId, end, target }: EndChange): ReconnectChange => ({
  edge: edgeId,
  end,
  node: target.nodeId,
  ...(isBodyEnd(target) ? {} : { port: target.id }),
});

/** `specs` with every edge pickable, so a click selects it. */
export function withPickableEdges(specs: readonly DiagramSpec[]): DiagramSpec[] {
  return specs.map((s) => (diagramEdgeOf(s) !== null ? { ...s, pickable: true } : s));
}

type EditingProps = Pick<
  DiagramViewProps,
  'onConnect' | 'onReconnect' | 'onEditRoute' | 'onDelete' | 'onEditLabel' | 'onReorder' | 'onResize' | 'connectBodies' | 'canConnect'
  | 'portOptions' | 'ambient'
>;

export interface DiagramEditing {
  /** In registration order: the last is hit first. */
  layers: readonly RenderLayer<unknown>[];
  ambient: readonly Contribution[];
  actions: ActionsProp;
}

export function useDiagramEditing(
  props: EditingProps & { source: ParticipantSource<RectPose>; selected: () => readonly string[]; mode: 'connect' | 'show' | 'none' },
): DiagramEditing {
  const { source, selected, mode, canConnect, portOptions, connectBodies } = props;
  const report = useLatest(props);
  const reconnects = props.onReconnect !== undefined;
  const routes = props.onEditRoute !== undefined;
  const labels = props.onEditLabel !== undefined;
  const deletes = props.onDelete !== undefined;
  const reorders = props.onReorder !== undefined;
  const resizes = props.onResize !== undefined;

  const ports = useMemo(() => mode === 'connect'
    ? diagramPorts<RectPose>({
        ...portOptions,
        participants: source,
        bodies: connectBodies === true,
        ...(canConnect ? { canConnect } : {}),
        commit: ({ from, to }) => report.current.onConnect?.({
          from: from.nodeId,
          ...(isBodyEnd(from) ? {} : { fromPort: from.id }),
          to: to.nodeId,
          ...(isBodyEnd(to) ? {} : { toPort: to.id }),
        }),
      })
    : null, [mode, source, canConnect, portOptions, connectBodies, report]);
  // A registered layer with no `hitTest` is painted and claims no press.
  const shown = useMemo(() => {
    if (mode !== 'show') return null;
    const { hitTest: _hitTest, ...paintOnly } = portLayer<RectPose>(source, portOptions);
    return paintOnly;
  }, [mode, source, portOptions]);
  const ends = useMemo(() => reconnects
    ? diagramEdgeEnds<RectPose>({
        participants: source,
        selected,
        bodies: connectBodies === true,
        ...(canConnect ? { canConnect } : {}),
        ...(portOptions?.snapRadius !== undefined ? { snapRadius: portOptions.snapRadius } : {}),
        ...(portOptions?.showsPort ? { showsPort: portOptions.showsPort } : {}),
        commit: (change) => report.current.onReconnect?.(reconnectChangeOf(change)),
      })
    : null, [reconnects, source, selected, connectBodies, canConnect, portOptions, report]);
  const route = useMemo(() => routes
    ? diagramWaypoints<RectPose>({
        participants: source,
        selected,
        commit: ({ edgeId, waypoints }) => report.current.onEditRoute?.({ edge: edgeId, waypoints }),
      })
    : null, [routes, source, selected, report]);
  const label = useMemo((): Contribution | null => labels
    ? {
        id: 'weasel-diagram-edge-label',
        eligibility: { always: true },
        actions: [editEdgeLabelAction({ commit: (edgeId) => report.current.onEditLabel?.(edgeId) })],
        bindings: [editEdgeLabelBinding()],
      }
    : null, [labels, report]);
  const reorder = useMemo(
    () => (reorders ? groupReorderContribution((change) => report.current.onReorder?.(change)) : null),
    [reorders, report],
  );
  const actions = useMemo(() => ({
    ...NO_MARQUEE,
    ...(deletes ? { delete: reportDeleteAction((r) => report.current.onDelete?.(r)) } : {}),
    ...(resizes ? { resize: reportResizeAction((r) => report.current.onResize?.(r)) } : {}),
  }), [deletes, resizes, report]);

  const portsLayer = ports?.layer ?? shown;
  const layers = useMemo(
    // Edge ends last: an edge's end sits on a port and beside a route handle, and the last layer is hit first.
    () => [portsLayer, route?.layer, ends?.layer].filter((l): l is RenderLayer<unknown> => l != null),
    [portsLayer, route, ends],
  );
  const extra = props.ambient;
  const ambient = useMemo(() => [
    ...AMBIENT,
    ...[ports?.contribution, route?.contribution, ends?.contribution, label, reorder].filter((c): c is Contribution => c != null),
    ...(extra ?? []),
  ], [ports, route, ends, label, reorder, extra]);
  return { layers, ambient, actions };
}

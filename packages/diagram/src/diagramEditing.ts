/**
 * What `DiagramView` installs for each editing callback it is handed. Every
 * action keeps its gesture and swaps its commit for one that reports a data
 * edit, so the host changes its data and the view follows through the specs.
 */
import {
  ActionDisabledReason,
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
import { diagramPorts } from './contribution';
import { editEdgeLabelAction, editEdgeLabelBinding } from './edgeLabel';
import { diagramEdgeOf } from './edgeTrait';
import type { DiagramSpec } from './fromData';
import { diagramGroupOf } from './group';
import type { ParticipantSource } from './portAffordance';
import { portLayer } from './portLayer';
import { diagramEdgeEnds, type EndChange } from './reconnect';
import { dataKeyReader } from './trait';
import type { DeleteReport, DiagramViewProps, ReconnectChange } from './diagramViewProps';

const AMBIENT = [dragPanContribution()];
// A drag on empty canvas pans: the select tool's marquee would outrank the ambient pan.
const NO_MARQUEE = { areaSelect: null };

/** The data ids a removal of `ids` takes: the nodes, and every edge on them. */
export function removedData(scene: Scene<unknown, string, unknown>, ids: readonly string[]): DeleteReport {
  const nodes: string[] = [];
  const edges: string[] = [];
  const live = ids.filter((id) => scene.get(id as never) !== undefined);
  for (const id of scene.removalClosure(live as never)) {
    const node = scene.get(id);
    if (node === undefined) continue;
    if (diagramEdgeOf(node) !== null) edges.push(id);
    else if (dataKeyReader(node) !== null && diagramGroupOf(node) === null) nodes.push(id);
  }
  return { nodes, edges };
}

/** Core's `delete`, on its keys, reporting what it would remove instead of removing it. */
export function reportDeleteAction(report: (removed: DeleteReport) => void): Action {
  return {
    id: 'delete',
    label: 'Delete',
    group: 'edit',
    defaultBinding: { kind: 'key', key: ['Delete', 'Backspace'], phase: [{ channel: '*', phase: 'initial' }] },
    requires: ['scene', 'selection'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const ids = (deps.selection?.get() ?? []) as readonly string[];
        if (deps.scene === undefined || ids.length === 0) return;
        report(removedData(deps.scene as Scene<unknown, string, unknown>, ids));
      },
    },
    enabled: (deps) => ((deps?.selection?.get().length ?? 0) > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}

export const reconnectChangeOf = ({ edgeId, end, target }: EndChange): ReconnectChange => ({
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
  'onConnect' | 'onReconnect' | 'onDelete' | 'onEditLabel' | 'connectBodies' | 'canConnect' | 'portOptions' | 'ambient'
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
  const labels = props.onEditLabel !== undefined;
  const deletes = props.onDelete !== undefined;

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
        ...(canConnect ? { canConnect } : {}),
        ...(portOptions?.snapRadius !== undefined ? { snapRadius: portOptions.snapRadius } : {}),
        ...(portOptions?.showsPort ? { showsPort: portOptions.showsPort } : {}),
        commit: (change) => report.current.onReconnect?.(reconnectChangeOf(change)),
      })
    : null, [reconnects, source, selected, canConnect, portOptions, report]);
  const label = useMemo((): Contribution | null => labels
    ? {
        id: 'weasel-diagram-edge-label',
        eligibility: { always: true },
        actions: [editEdgeLabelAction({ commit: (edgeId) => report.current.onEditLabel?.(edgeId) })],
        bindings: [editEdgeLabelBinding()],
      }
    : null, [labels, report]);
  const actions = useMemo(
    () => (deletes ? { ...NO_MARQUEE, delete: reportDeleteAction((r) => report.current.onDelete?.(r)) } : NO_MARQUEE),
    [deletes, report],
  );

  const portsLayer = ports?.layer ?? shown;
  const layers = useMemo(
    // Edge ends after ports: an edge's end sits on a port, and the last layer is hit first.
    () => [portsLayer, ends?.layer].filter((l): l is RenderLayer<unknown> => l != null),
    [portsLayer, ends],
  );
  const extra = props.ambient;
  const ambient = useMemo(() => [
    ...AMBIENT,
    ...[ports?.contribution, ends?.contribution, label].filter((c): c is Contribution => c != null),
    ...(extra ?? []),
  ], [ports, ends, label, extra]);
  return { layers, ambient, actions };
}

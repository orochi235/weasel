/**
 * Writing what `DiagramView` reports back into the `DiagramData` it was built
 * from, the way each report's docs say to store it.
 */
import type { DiagramEdit } from './batchedEdits';
import type { DataContainer, DataEdge, DataLane, DataNode, DiagramData } from './dataTypes';
import { edgeIdOf } from './edgeId';
import type { NodeResize } from './diagramViewProps';

/** Options for {@link applyDiagramEdit} and {@link applyNodeResizes}. */
export interface ApplyEditOptions {
  /** Pin what moved, so the next `diagramScene` leaves it where it was left. Default true. */
  pin?: boolean;
}

/** `data` with `edit` stored in it: each moved node at its new place and
 *  pinned, moved into the region its move names as `parent` (`null` for the
 *  top level), each rerouted edge's `routed` and `routedPorts`, each region
 *  `box` pinned where it was left, each pool's `lanes` in their new order and
 *  sizes, and a released container gone with its members handed to the region
 *  that held it. A `title` edit changes nothing: the host edits the label.
 *  What the edit does not name is returned as it was.
 *
 *  `pin: false` leaves moved nodes and boxes unpinned, for data `diagramScene`
 *  builds with `layout: 'none'`, where nothing lays them out again and a later
 *  `DiagramViewApi.layout` run should still move them. */
export function applyDiagramEdit(data: DiagramData, edit: DiagramEdit, opts: ApplyEditOptions = {}): DiagramData {
  const pin = opts.pin ?? true;
  let containers = data.containers;
  for (const m of edit.moves) {
    if (m.parent !== undefined && containers !== undefined) containers = reparent(containers, m.id, m.parent);
  }
  for (const e of edit.containers) {
    if (containers === undefined) break;
    if (e.kind === 'box') {
      containers = containers.map((c) => (c.id === e.id ? { ...c, box: e.box, ...(pin ? { pinned: true } : {}) } : c));
      if (e.parent !== undefined) containers = reparent(containers, e.id, e.parent);
    } else if (e.kind === 'lanes') {
      containers = containers.map((c) => (c.id === e.pool ? { ...c, lanes: relaned(c.lanes ?? [], e.lanes) } : c));
    } else if (e.kind === 'release') {
      containers = release(containers, e.id);
    }
  }
  const at = new Map(edit.moves.map((m) => [m.id, { x: m.x, y: m.y }]));
  const routes = new Map(edit.routes.map((r) => [r.id, r]));
  return {
    ...data,
    nodes: at.size === 0 ? data.nodes : data.nodes.map((n): DataNode => {
      const to = at.get(n.id);
      return to === undefined ? n : { ...n, at: to, ...(pin ? { pinned: true } : {}) };
    }),
    edges: routes.size === 0 ? data.edges : data.edges.map((e): DataEdge => {
      const r = routes.get(edgeIdOf(e));
      return r === undefined ? e : { ...e, routed: r.waypoints, routedPorts: r.ports };
    }),
    ...(containers === undefined ? {} : { containers }),
  };
}

/** `data` with each resized node's box stored as its `at`, `width` and
 *  `height`, pinned unless `pin` is false, as `onResize` says to. */
export function applyNodeResizes(data: DiagramData, resizes: readonly NodeResize[], opts: ApplyEditOptions = {}): DiagramData {
  const pin = opts.pin ?? true;
  const by = new Map(resizes.map((r) => [r.id, r]));
  return {
    ...data,
    nodes: data.nodes.map((n): DataNode => {
      const r = by.get(n.id);
      return r === undefined ? n : { ...n, at: { x: r.x, y: r.y }, width: r.width, height: r.height, ...(pin ? { pinned: true } : {}) };
    }),
  };
}

const without = (ids: readonly string[] | undefined, id: string) => ids?.filter((x) => x !== id);

/** `id` out of every region's members and into `parent`'s, last. */
function reparent(containers: readonly DataContainer[], id: string, parent: string | null): DataContainer[] {
  return containers.map((c) => {
    const lanes = c.lanes?.map((l): DataLane => ({
      ...l,
      members: l.id === parent ? [...(without(l.members, id) ?? []), id] : without(l.members, id),
    }));
    const members = c.id === parent ? [...(without(c.members, id) ?? []), id] : without(c.members, id);
    return { ...c, ...(members === undefined ? {} : { members }), ...(lanes === undefined ? {} : { lanes }) };
  });
}

function relaned(was: readonly DataLane[], order: readonly { id: string; size: number }[]): DataLane[] {
  const by = new Map(was.map((l) => [l.id, l]));
  return order.map(({ id, size }) => ({ ...(by.get(id) ?? { id }), size }));
}

/** The container gone, its members in its place in whichever region held it. */
function release(containers: readonly DataContainer[], id: string): DataContainer[] {
  const gone = containers.find((c) => c.id === id);
  const freed = gone?.members ?? [];
  const lift = (ids: readonly string[] | undefined) =>
    ids?.includes(id) ? ids.flatMap((m) => (m === id ? freed : [m])) : ids;
  return containers.filter((c) => c.id !== id).map((c) => {
    const members = lift(c.members);
    const lanes = c.lanes?.map((l): DataLane => {
      const m = lift(l.members);
      return m === undefined ? l : { ...l, members: m };
    });
    return { ...c, ...(members === undefined ? {} : { members }), ...(lanes === undefined ? {} : { lanes }) };
  });
}

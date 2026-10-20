/**
 * `diagramScene`'s containers and pools: which nodes and regions each region
 * holds, and what layout sees of them. `dataContainerPlace.ts` places them and
 * builds their specs.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { GroupInset } from './cluster';
import { CONTAINER_HEADER } from './containers/layouts';
import { MIN_LANE_SIZE } from './containers/laneStack';
import type { ContainerRole } from './containers/trait';
import { DEFAULT_LANE_SIZE, DEFAULT_POOL_ACROSS, type DataContainer, type NodeStyle } from './dataTypes';
import type { GraphGroup, GraphNode } from './graph';

type Rect = { x: number; y: number; width: number; height: number };

/** A container's size when it gives no box and holds nothing to fit. */
export const EMPTY_CONTAINER = { width: 240, height: 160 };

/** A container, pool, or lane with its members settled. */
export interface DataRegion {
  id: string;
  role: ContainerRole;
  /** The axis its pool stacks along; `'y'` for a plain container. */
  axis: 'x' | 'y';
  label?: string;
  style?: string;
  colors?: Partial<NodeStyle>;
  /** The region it is directly inside. */
  parent?: string;
  /** What it holds directly: a pool its lanes, else node and container ids. */
  direct: string[];
  /** A container's or a pool's own box. */
  box?: Rect;
  /** A lane's size along its pool's stack. */
  size?: number;
  pinned: boolean;
  /** A container whose box fits what it holds: one with no `box` that holds something. */
  fitted: boolean;
  /** A lane's place in its pool. */
  index: number;
}

/** Every region, outer before inner, and the region each node or region is directly inside. */
export interface DataRegions {
  regions: readonly DataRegion[];
  parentOf: ReadonlyMap<string, string>;
}

/**
 * Settle what each region holds. A member already claimed, a pool, an
 * unknown id, and a claim that would put a container inside itself are
 * passed over. Throws on a container or lane id already in `ids`, and adds
 * each to it.
 */
export function resolveContainers(
  containers: readonly DataContainer[],
  ids: Set<string>,
  nodeIds: ReadonlySet<string>,
): DataRegions {
  const byId = new Map<string, DataRegion>();
  const parentOf = new Map<string, string>();
  const declare = (r: DataRegion) => {
    if (ids.has(r.id)) throw new Error(`diagramScene: container id "${r.id}" is already a node, group, or container id`);
    ids.add(r.id);
    byId.set(r.id, r);
  };
  const base = { direct: [], pinned: false, fitted: false, index: 0 };
  for (const c of containers) {
    const axis = c.role === 'pool' ? c.axis ?? 'y' : 'y';
    declare({
      ...base, direct: [], id: c.id, role: c.role, axis, pinned: c.pinned === true,
      ...(c.label !== undefined ? { label: c.label } : {}), ...(c.style !== undefined ? { style: c.style } : {}),
      ...(c.colors !== undefined ? { colors: c.colors } : {}),
      ...(c.box !== undefined ? { box: { ...c.box } } : {}),
    });
    if (c.role !== 'pool') continue;
    (c.lanes ?? []).forEach((l, index) => {
      declare({
        ...base, direct: [], id: l.id, role: 'lane', axis, index, parent: c.id,
        ...(l.label !== undefined ? { label: l.label } : {}), ...(l.size !== undefined ? { size: l.size } : {}),
        ...(l.colors !== undefined ? { colors: l.colors } : {}),
      });
      parentOf.set(l.id, c.id);
      byId.get(c.id)!.direct.push(l.id);
    });
  }
  const claim = (holder: DataRegion, id: string) => {
    if (parentOf.has(id)) return;
    const region = byId.get(id);
    if (region === undefined ? !nodeIds.has(id) : region.role !== 'container') return;
    for (let at: string | undefined = holder.id; at !== undefined; at = parentOf.get(at)) if (at === id) return;
    parentOf.set(id, holder.id);
    holder.direct.push(id);
  };
  for (const c of containers) {
    if (c.role === 'container') for (const m of c.members ?? []) claim(byId.get(c.id)!, m);
    else for (const l of c.lanes ?? []) for (const m of l.members ?? []) claim(byId.get(l.id)!, m);
  }
  const regions: DataRegion[] = [];
  const visit = (r: DataRegion) => {
    const parent = parentOf.get(r.id);
    if (parent !== undefined) r.parent = parent;
    r.fitted = r.role === 'container' && r.box === undefined && r.direct.length > 0;
    regions.push(r);
    for (const id of r.direct) {
      const inner = byId.get(id);
      if (inner !== undefined) visit(inner);
    }
  };
  for (const r of byId.values()) if (!parentOf.has(r.id)) visit(r);
  return { regions, parentOf };
}

/** What layout sees of the regions. */
export interface ContainerLayout {
  /** Each outermost boxed region, as one node at its box. */
  nodes: GraphNode[];
  /** Each fitted container outside every boxed region, kept together as a group. */
  groups: GraphGroup[];
  /** The fitted container each node layout sees is directly inside. */
  groupOf: ReadonlyMap<string, string>;
  /** Every node and region inside a boxed region, which layout does not see. */
  hidden: ReadonlySet<string>;
  /** The outermost boxed region holding `id` or being it, else `id`: what an edge's end ranks against. */
  endOf(id: string): string;
}

/** The inset a fitted container keeps around what it holds: its header, and `pad` all round. */
export const fittedInset = (pad: number): GroupInset => ({ top: CONTAINER_HEADER.size + pad, right: pad, bottom: pad, left: pad });

/** A pool's lane sizes along its stack, the lanes giving none sharing what the box leaves. */
export function laneSizes(lanes: readonly DataRegion[], along: number | undefined): number[] {
  if (along === undefined) return lanes.map((l) => Math.max(MIN_LANE_SIZE, l.size ?? DEFAULT_LANE_SIZE));
  const given = lanes.reduce((s, l) => s + (l.size ?? 0), 0);
  const unsized = lanes.filter((l) => l.size === undefined).length;
  const share = unsized === 0 ? 0 : (along - given) / unsized;
  const sizes = lanes.map((l) => Math.max(MIN_LANE_SIZE, l.size ?? share));
  if (sizes.length > 0) sizes[sizes.length - 1] = Math.max(MIN_LANE_SIZE, sizes[sizes.length - 1]! + along - sizes.reduce((s, n) => s + n, 0));
  return sizes;
}

/** The box a boxed region starts at: its own, or a default size at `seed`. */
function startBox(r: DataRegion, lanes: readonly DataRegion[], seed: Vec2): Rect {
  if (r.box !== undefined) return r.box;
  if (r.role !== 'pool') return { ...seed, ...EMPTY_CONTAINER };
  const along = Math.max(MIN_LANE_SIZE, laneSizes(lanes, undefined).reduce((s, n) => s + n, 0));
  return r.axis === 'y'
    ? { ...seed, width: DEFAULT_POOL_ACROSS, height: along }
    : { ...seed, width: along, height: DEFAULT_POOL_ACROSS };
}

/**
 * What layout sees of `regions`: an outermost boxed region is one node, a
 * fitted container outside every boxed region is a group around what it
 * holds, and everything inside a boxed region is hidden. `seed` is where a
 * region giving no box starts, by its place among the regions.
 */
export function containerLayoutNodes(
  { regions, parentOf }: DataRegions,
  opts: { padding: number; seed: (k: number) => Vec2 },
): ContainerLayout {
  const byId = new Map(regions.map((r) => [r.id, r]));
  const rootOf = new Map<string, string>();
  for (const r of regions) {
    const outer = r.parent === undefined ? undefined : rootOf.get(r.parent);
    const root = outer ?? (r.fitted ? undefined : r.id);
    if (root !== undefined) rootOf.set(r.id, root);
  }
  const endOf = (id: string): string => {
    if (byId.has(id)) return rootOf.get(id) ?? id;
    const parent = parentOf.get(id);
    return (parent === undefined ? undefined : rootOf.get(parent)) ?? id;
  };
  const hidden = new Set<string>([...parentOf.keys()].filter((id) => endOf(id) !== id));
  const nodes: GraphNode[] = [];
  regions.forEach((r, k) => {
    if (rootOf.get(r.id) !== r.id) return;
    const lanes = r.direct.flatMap((id) => { const l = byId.get(id); return l?.role === 'lane' ? [l] : []; });
    nodes.push({ id: r.id, bounds: startBox(r, lanes, opts.seed(k)), pinned: r.pinned });
  });
  const seen = (id: string) => !hidden.has(id) && !(byId.get(id)?.fitted ?? false);
  const below = (r: DataRegion): string[] =>
    r.direct.flatMap((id) => (seen(id) ? [id] : byId.get(id)?.fitted === true && !hidden.has(id) ? below(byId.get(id)!) : []));
  const groups: GraphGroup[] = [];
  const groupOf = new Map<string, string>();
  for (const r of regions) {
    if (!r.fitted || hidden.has(r.id) || rootOf.has(r.id)) continue;
    groups.push({ id: r.id, members: below(r), inset: fittedInset(opts.padding), ...(r.parent !== undefined ? { parent: r.parent } : {}) });
    for (const id of r.direct) if (seen(id)) groupOf.set(id, r.id);
  }
  return { nodes, groups, groupOf, hidden, endOf };
}

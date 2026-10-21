/**
 * Label placement on a live scene: a scene edit pass that moves the labels
 * an edit covered to the nearest clear station, in that edit's own history
 * entry. It runs after routing, so labels dodge the routes the edit made.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  createSetDataOp,
  documentDepOf,
  documentPose,
  type NodeId,
  type Op,
  type PoseDescriptor,
  type Scene,
  type SceneEditSummary,
} from '@weasel-js/core';
import { PATH_M, type Path, type Vec2 } from '@weasel-js/core/math';
import type { MeasureRowText } from '../body';
import { diagramContainerOf } from '../containers/trait';
import { diagramEdgeOf } from '../edgeTrait';
import { diagramGroupOf } from '../group';
import { diagramLabelOf, type DiagramLabel, type LabelSpot } from '../labelTrait';
import type { Bounds } from '../outline';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { diagramNodeOf, type DiagramNodeReader } from '../trait';
import { labelFitOps } from './fit';
import { placeLabels, type PlaceLabel, type PlaceLabelsOptions, type PlaceRoute } from './place';
import { labelCenter } from './station';

/** Options for {@link installLabelPlacement} and `useLabelPlacement`. */
export interface LabelPlacementOptions<TPose> extends PlaceLabelsOptions {
  geometry?: PoseDescriptor<TPose>;
  /** How a node's diagram trait is read. Default its own `data.diagram`. */
  read?: DiagramNodeReader;
  /** Sizes a label to the text an edit gives it. Default a per-character estimate. */
  measure?: MeasureRowText;
}

/** Placement installed on a scene. */
export interface LabelPlacement {
  /** Remove the edit pass. */
  dispose(): void;
}

type AnyScene = Scene<unknown, string, unknown>;
type Size = { width: number; height: number };
type SceneNode = ReturnType<AnyScene['renderOrderNodes']>[number];

/** The scene as placement reads it. */
interface Reading {
  shapes: { id: string; box: Bounds }[];
  routes: Map<string, PlaceRoute & { path: Path; ends: readonly string[] }>;
  labels: (PlaceLabel & { node: SceneNode })[];
}

/** The points of each run of a polyline path: one for a whole connector, a
 *  stub at each end for one split across pages. */
function runsOf(path: Path | null): Vec2[][] {
  if (path === null || path.kind !== 'polygon') return [];
  const runs: Vec2[][] = [];
  for (let i = 0; i < path.commands.length; i++) {
    if (path.commands[i] === PATH_M || runs.length === 0) runs.push([]);
    runs[runs.length - 1]!.push({ x: path.coords[2 * i]!, y: path.coords[2 * i + 1]! });
  }
  return runs.filter((r) => r.length >= 2);
}

function read(
  sc: AnyScene, geometry: PoseDescriptor<unknown>, reader: DiagramNodeReader | undefined, sizes?: ReadonlyMap<string, Size>,
): Reading {
  const out: Reading = { shapes: [], routes: new Map(), labels: [] };
  for (const node of sc.renderOrderNodes()) {
    const ends = Array.isArray(node.dependsOn) ? node.dependsOn as readonly string[] : [];
    if (diagramEdgeOf(node) !== null) {
      const path = documentDepOf(sc, node.id as NodeId)?.path ?? null;
      const [points, ...more] = runsOf(path);
      if (path !== null && points !== undefined) out.routes.set(node.id, { id: node.id, points, more, path, ends });
      continue;
    }
    const placement = diagramLabelOf(node);
    if (placement !== null) {
      const { width, height } = sizes?.get(node.id) ?? geometry.getBounds(node.pose);
      if (ends[0] !== undefined) out.labels.push({ id: node.id, edge: ends[0], placement, size: { width, height }, node });
      continue;
    }
    if (diagramContainerOf(node) !== null || diagramGroupOf(node) !== null || diagramNodeOf(node as never, reader) === null) continue;
    out.shapes.push({ id: node.id, box: geometry.getBounds(documentPose(sc, node as never)) });
  }
  return out;
}

const grow = (b: Bounds, by: number): Bounds => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by });
const meets = (a: Bounds, b: Bounds) => a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** Whether any segment of `points` comes within `box`. */
function routeMeets(points: readonly Vec2[], box: Bounds): boolean {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const seg = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
    if (meets(seg, box)) return true;
  }
  return false;
}

/** What the last pass saw, so an edit that moves something away from a
 *  label still finds that label. Undo runs no pass, so this may be stale,
 *  which only moves more labels than it must. */
const runsIn = (r: PlaceRoute): (readonly Vec2[])[] => [r.points, ...(r.more ?? [])];

interface Seen {
  shapes: Map<string, Bounds>;
  routes: Map<string, readonly (readonly Vec2[])[]>;
}

/** The boxes and routes `summary`'s edit changed, as they were and as they are. */
function changesOf(scene: Reading, summary: SceneEditSummary, seen: Seen) {
  const touched = (id: string) => summary.added.has(id as NodeId) || summary.posed.has(id as NodeId) || summary.dataChanged.has(id as NodeId);
  const edges = new Set<string>();
  const routes: (readonly Vec2[])[] = [];
  for (const r of scene.routes.values()) {
    if (!touched(r.id) && !r.ends.some((e) => touched(e) || summary.removed.has(e as NodeId))) continue;
    edges.add(r.id);
    routes.push(...runsIn(r));
    routes.push(...seen.routes.get(r.id) ?? []);
  }
  const shapes: Bounds[] = [];
  for (const s of scene.shapes) {
    if (!touched(s.id)) continue;
    shapes.push(s.box);
    const was = seen.shapes.get(s.id);
    if (was !== undefined) shapes.push(was);
  }
  for (const id of summary.removed) {
    const shape = seen.shapes.get(id);
    if (shape !== undefined) shapes.push(shape);
    routes.push(...seen.routes.get(id) ?? []);
  }
  return { touched, edges, routes, shapes };
}

/** The boxes `label` stands in now and would stand in at its preference, grown by `gap`. */
function boxesOf(scene: Reading, label: PlaceLabel, gap: number): Bounds[] {
  const route = scene.routes.get(label.edge);
  if (route === undefined) return [];
  const { placed, ...preferred } = label.placement;
  const out: Bounds[] = [];
  for (const placement of placed === undefined ? [preferred] : [label.placement, preferred]) {
    const c = labelCenter(route.path, placement, label.size);
    if (c !== null) out.push(grow({ x: c.x - label.size.width / 2, y: c.y - label.size.height / 2, ...label.size }, gap));
  }
  return out;
}

/** The ids of the labels `summary`'s edit may have covered or uncovered:
 *  those of edges it changed or whose ends it moved, those it added or
 *  changed, and those whose box, where it stands or at its preference, meets
 *  a shape or route the edit changed, or another such label. */
function movingOf(scene: Reading, summary: SceneEditSummary, seen: Seen, gap: number): Set<string> {
  const changed = changesOf(scene, summary, seen);
  const boxes = new Map(scene.labels.map((l) => [l.id, boxesOf(scene, l, gap)]));
  const first = new Set<string>();
  for (const l of scene.labels) {
    const own = boxes.get(l.id)!;
    const hit = own.some((box) => changed.shapes.some((s) => meets(s, box)) || changed.routes.some((r) => routeMeets(r, box)));
    if (changed.edges.has(l.edge) || changed.touched(l.id) || hit) first.add(l.id);
  }
  const moving = new Set(first);
  for (const l of scene.labels) {
    if (moving.has(l.id)) continue;
    const own = boxes.get(l.id)!;
    for (const id of first) if (boxes.get(id)!.some((b) => own.some((o) => meets(b, o)))) moving.add(l.id);
  }
  return moving;
}

const sameSpot = (a: LabelSpot | undefined, b: LabelSpot | undefined) =>
  a === b || (a !== undefined && b !== undefined && Math.abs(a.at - b.at) < 1e-9 && Math.abs(a.offset - b.offset) < 1e-9);

/** `data` with its label trait standing at `spot`, or back at its preference when undefined. */
function withSpot(data: unknown, label: DiagramLabel, spot: LabelSpot | undefined): Record<string, unknown> {
  const { placed: _p, ...rest } = label;
  const diagram = (data as { diagram: object }).diagram;
  return { ...(data as Record<string, unknown>), diagram: { ...diagram, label: spot === undefined ? rest : { ...rest, placed: spot } } };
}

/** The writes that size each label to its edited text and place the labels
 *  `summary`'s edit covered, skipping any that stay put. */
function placementOps<TPose>(
  scene: Scene<unknown, string, TPose>,
  summary: SceneEditSummary,
  opts: LabelPlacementOptions<TPose>,
  seen: Seen,
): Op[] {
  const sc = scene as unknown as AnyScene;
  const geometry = (opts.geometry ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;
  const fit = labelFitOps(sc, summary, opts.measure);
  const reading = read(sc, geometry, opts.read, fit.sizes);
  const moving = movingOf(reading, summary, seen, opts.gap ?? 2);
  seen.shapes = new Map(reading.shapes.map((s) => [s.id, s.box]));
  seen.routes = new Map([...reading.routes.values()].map((r) => [r.id, runsIn(r)]));
  if (moving.size === 0) return fit.ops;
  const labels = reading.labels.map((l) => ({ ...l, moving: moving.has(l.id) }));
  const placed = placeLabels({ shapes: reading.shapes, routes: [...reading.routes.values()], labels }, opts);
  const ops: Op[] = [...fit.ops];
  for (const l of labels) {
    if (!placed.has(l.id)) continue;
    const spot = placed.get(l.id) ?? undefined;
    if (sameSpot(l.placement.placed, spot)) continue;
    ops.push(createSetDataOp({ id: l.id, from: l.node.data, to: withSpot(l.node.data, l.placement, spot), label: 'Place label' }));
  }
  return ops;
}

const any = (s: SceneEditSummary): boolean =>
  s.added.size + s.removed.size + s.posed.size + s.reparented.size + s.dataChanged.size > 0;

/**
 * Move `scene`'s edge labels off whatever an edit leaves covering them, from
 * now on: each live edit places the labels it may have covered, in its own
 * history entry. Labels hold still during a drag and settle on release. A
 * host without React calls this; a component calls `useLabelPlacement`.
 */
export function installLabelPlacement<TPose>(
  scene: Scene<unknown, string, TPose>,
  opts: LabelPlacementOptions<TPose> = {},
): LabelPlacement {
  const sc = scene as unknown as AnyScene;
  const first = read(sc, (opts.geometry ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>, opts.read);
  const seen: Seen = {
    shapes: new Map(first.shapes.map((s) => [s.id, s.box])),
    routes: new Map([...first.routes.values()].map((r) => [r.id, runsIn(r)])),
  };
  const dispose = scene.addEditPass((summary) => {
    if (!any(summary)) return null;
    const ops = placementOps(scene, summary, opts, seen);
    return ops.length === 0 ? null : ops;
  }, { order: DIAGRAM_PASS_ORDER.labels });
  return { dispose };
}

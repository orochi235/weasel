/**
 * Laying out a page whose nodes are not all placed, as a file with no
 * geometry gives them: once, on import, so the scene holds places rather than
 * a layout to run again.
 */
import { IDENTITY_POSE_COMPOSITION } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import {
  diagramScene, edgeIdOf, type DataContainer, type DataEdge, type DiagramEdge, type DiagramLabel, type DiagramSpec,
  type DiagramTheme, type MeasureRowText,
} from '@weasel-js/diagram';
import type { DocumentPage } from './document';
import { shiftData } from './shiftData';

/** Room kept between a laid-out page's edges and what is on it. */
export const PAGE_MARGIN = 40;

type Rect = { x: number; y: number; width: number; height: number };

/** A pool or an empty container with no box: only layout places it. A container that holds something fits it instead. */
const unplacedRegion = (c: DataContainer): boolean => c.box === undefined && (c.role === 'pool' || (c.members ?? []).length === 0);

/** Whether `page` has a node with no `at`, or a region only layout places. */
export function needsLayout(page: DocumentPage): boolean {
  return page.data.nodes.some((n) => n.at === undefined) || (page.data.containers ?? []).some(unplacedRegion);
}

/** An edge's route and ports as layout chose them, as `routed` and `routedPorts`, and its label where layout left it room. */
function laidEdge(e: DataEdge, specs: ReadonlyMap<string, DiagramSpec>): DataEdge {
  const id = edgeIdOf(e);
  const trait = specs.get(id)?.data.diagram as DiagramEdge | undefined;
  if (trait === undefined) return e;
  const from = e.fromPort === undefined ? trait.from.laidOut : undefined;
  const to = e.toPort === undefined ? trait.to.laidOut : undefined;
  const label = (specs.get(`${id}/label`)?.data.diagram as { label?: DiagramLabel } | undefined)?.label;
  const follows = e.labelPlacement === undefined || e.labelPlacement.at === 'mid';
  return {
    ...e,
    ...(e.waypoints === undefined && e.routed === undefined && trait.laidOut !== undefined ? { routed: trait.laidOut } : {}),
    ...(from !== undefined || to !== undefined ? { routedPorts: { ...(from ? { from } : {}), ...(to ? { to } : {}) } } : {}),
    ...(follows && label !== undefined && typeof label.at === 'object' ? { labelPlacement: { ...e.labelPlacement, ...label } } : {}),
  };
}

const boxOf = (spec: DiagramSpec | undefined): Rect | undefined =>
  spec === undefined ? undefined : { x: spec.pose.x, y: spec.pose.y, width: spec.pose.width, height: spec.pose.height };

/**
 * `page` laid out with `layered`, the way its `direction` says, every node and
 * box it already places pinned there: each node gets an `at`, each pool and
 * empty container a box, and each edge the route layout chose as `routed`.
 * When the page placed nothing, what layout placed is moved to sit
 * {@link PAGE_MARGIN} inside its corner. The page grows to hold it all.
 */
export function laidOutPage(page: DocumentPage, opts: { theme: DiagramTheme; measure?: MeasureRowText }): DocumentPage {
  const { data } = page;
  const placedAny = data.nodes.some((n) => n.at !== undefined) || (data.containers ?? []).some((c) => c.box !== undefined);
  const pinned = {
    ...data,
    nodes: data.nodes.map((n) => (n.at !== undefined ? { ...n, pinned: true } : n)),
    ...(data.containers ? { containers: data.containers.map((c) => (c.box !== undefined ? { ...c, pinned: true } : c)) } : {}),
  };
  // Read as laid out, in world.
  const specs = diagramScene(pinned, {
    layout: 'layered', theme: opts.theme, composition: IDENTITY_POSE_COMPOSITION, ...(opts.measure ? { measure: opts.measure } : {}),
    ...(page.direction ? { layoutOptions: { direction: page.direction } } : {}),
  });
  const byId = new Map(specs.map((s) => [s.id as string, s]));
  const boxed = (c: DataContainer): DataContainer => {
    const box = unplacedRegion(c) ? boxOf(byId.get(c.id)) : undefined;
    return box === undefined ? c : { ...c, box };
  };
  const laid = {
    ...data,
    nodes: data.nodes.map((n) => {
      const box = boxOf(byId.get(n.id));
      return n.at !== undefined || box === undefined ? n : { ...n, at: { x: box.x, y: box.y } };
    }),
    edges: data.edges.map((e) => laidEdge(e, byId)),
    ...(data.containers ? { containers: data.containers.map(boxed) } : {}),
  };
  const ids = [...data.nodes.map((n) => n.id), ...(data.containers ?? []).map((c) => c.id)];
  const boxes = ids.map((id) => boxOf(byId.get(id))).filter((b): b is Rect => b !== undefined);
  if (boxes.length === 0) return { ...page, data: laid };
  const min: Vec2 = { x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)) };
  const by: Vec2 = placedAny ? { x: 0, y: 0 } : { x: PAGE_MARGIN - min.x, y: PAGE_MARGIN - min.y };
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + by.x + PAGE_MARGIN;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + by.y + PAGE_MARGIN;
  return {
    ...page,
    width: Math.max(page.width, Math.ceil(right)),
    height: Math.max(page.height, Math.ceil(bottom)),
    data: shiftData(laid, by),
  };
}

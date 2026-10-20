/**
 * Where `diagramScene`'s regions and the nodes inside boxed regions land once
 * layout has run, and the specs the regions are drawn with.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { GroupInset } from './cluster';
import { containerShape } from './containers/layouts';
import { stackedLanes } from './containers/laneStack';
import { regionSpecs } from './containers/regionSpecs';
import { bodyBox } from './containers/trait';
import { EMPTY_CONTAINER, fittedInset, laneSizes, type ContainerLayout, type DataRegion, type DataRegions } from './dataContainers';
import { NODE, type DiagramSpec, type NodeStyle } from './dataTypes';
import { ownNodeStyle, withColors } from './dataColors';
import { grownBy } from './footprint';
import type { DiagramTheme } from './theme/types';

type Rect = { x: number; y: number; width: number; height: number };

/** A data node as placement reads it: where it asked to start, its size, and how far past its box it reaches. */
export interface PlacedNodeSize {
  at?: Vec2;
  width: number;
  height: number;
  margin?: GroupInset;
}

/** Fill `out` with where the nodes no `at` places sit: in rows across `seat`'s body, in order. */
function seedRows(out: Map<string, Rect>, ids: readonly string[], body: Rect, sizes: ReadonlyMap<string, PlacedNodeSize>, pad: number): void {
  let x = body.x + pad;
  let y = body.y + pad;
  let row = 0;
  for (const id of ids) {
    const { width, height } = sizes.get(id)!;
    if (x > body.x + pad && x + width > body.x + body.width - pad) {
      x = body.x + pad;
      y += row + pad;
      row = 0;
    }
    out.set(id, { x, y, width, height });
    x += width + pad;
    row = Math.max(row, height);
  }
}

/**
 * Every region's box, and where each node inside a boxed region sits. A node
 * with an `at` moves by as much as layout moved its outermost boxed region;
 * one without is seeded in its nearest boxed region's body. A fitted
 * container's box is the union of what it holds, grown by its inset.
 * `placed` is where layout put everything it saw.
 */
export function placeContainers(
  { regions, parentOf }: DataRegions,
  layout: ContainerLayout,
  placed: ReadonlyMap<string, Rect>,
  sizes: ReadonlyMap<string, PlacedNodeSize>,
  pad: number,
): Map<string, Rect> {
  const byId = new Map(regions.map((r) => [r.id, r]));
  const start = new Map(layout.nodes.map((n) => [n.id, n.bounds]));
  const delta = (id: string): Vec2 => {
    const root = layout.endOf(id);
    const from = start.get(root);
    const to = placed.get(root);
    return from === undefined || to === undefined ? { x: 0, y: 0 } : { x: to.x - from.x, y: to.y - from.y };
  };
  const out = new Map<string, Rect>();
  const seated = new Map(sizes);
  const empty: string[] = [];
  for (const r of regions) {
    if (r.fitted || r.role === 'lane') continue;
    const own = placed.get(r.id);
    const d = delta(r.id);
    const box = own ?? (r.box !== undefined ? { ...r.box, x: r.box.x + d.x, y: r.box.y + d.y } : null);
    if (box === null) {
      empty.push(r.id);
      seated.set(r.id, EMPTY_CONTAINER);
      continue;
    }
    out.set(r.id, box);
    if (r.role !== 'pool') continue;
    const lanes = r.direct.map((id) => byId.get(id)!);
    const along = r.axis === 'y' ? box.height : box.width;
    const sizes = laneSizes(lanes, r.box === undefined ? undefined : along);
    const stacked = stackedLanes(r.axis, box, containerShape('pool', r.axis).header, lanes.map((l, i) => ({ id: l.id, size: sizes[i]! })));
    for (const [id, pose] of stacked) out.set(id, pose);
  }
  const seatOf = (id: string): DataRegion | undefined => {
    let at = byId.get(parentOf.get(id) ?? '');
    while (at !== undefined && at.fitted) at = byId.get(at.parent ?? '');
    return at;
  };
  const unseated = new Map<DataRegion, string[]>();
  for (const [id, size] of seated) {
    if (!layout.hidden.has(id) || (byId.has(id) && !empty.includes(id))) continue;
    if (size.at !== undefined) {
      const d = delta(id);
      out.set(id, { x: size.at.x + d.x, y: size.at.y + d.y, width: size.width, height: size.height });
      continue;
    }
    const seat = seatOf(id)!;
    unseated.set(seat, [...(unseated.get(seat) ?? []), id]);
  }
  for (const [seat, ids] of unseated) {
    seedRows(out, ids, bodyBox(out.get(seat.id)!, containerShape(seat.role, seat.axis).header), seated, pad);
  }
  const footprint = (id: string): Rect | undefined => {
    if (byId.has(id)) return out.get(id);
    const at = out.get(id) ?? placed.get(id);
    return at === undefined ? undefined : grownBy(at, sizes.get(id)?.margin);
  };
  for (const r of [...regions].reverse()) {
    if (!r.fitted) continue;
    const rs = r.direct.map(footprint).filter((b): b is Rect => b !== undefined);
    const inset = fittedInset(pad);
    const x = Math.min(...rs.map((b) => b.x)) - inset.left;
    const y = Math.min(...rs.map((b) => b.y)) - inset.top;
    out.set(r.id, {
      x, y,
      width: Math.max(...rs.map((b) => b.x + b.width)) + inset.right - x,
      height: Math.max(...rs.map((b) => b.y + b.height)) + inset.bottom - y,
    });
  }
  return out;
}

/** The style a region is drawn in: its own colors over its theme role's, else over the theme's container, pool
 *  header, or lane body in turn. */
function regionStyle(r: DataRegion, theme: DiagramTheme | undefined): NodeStyle {
  return withColors(themeRegionStyle(r, theme), r.colors);
}

function themeRegionStyle(r: DataRegion, theme: DiagramTheme | undefined): NodeStyle {
  if (theme === undefined) return NODE;
  const own = r.style !== undefined ? theme.roles[r.style] : undefined;
  if (own !== undefined) return own;
  if (r.role === 'pool') return theme.lane.header;
  if (r.role === 'lane') return theme.lane.bodies[r.index % Math.max(1, theme.lane.bodies.length)] ?? theme.container;
  return theme.container;
}

/** Each region's specs and its title's, outer regions first, as `createScene` needs parents before what they hold.
 *  Titles are set in `fontFamily`, the diagram's face. */
export function containerSpecs(
  { regions }: DataRegions,
  boxes: ReadonlyMap<string, Rect>,
  theme: DiagramTheme | undefined,
  fontFamily: string,
): DiagramSpec[] {
  return regions.flatMap((r) => {
    const box = boxes.get(r.id);
    if (box === undefined) return [];
    const specs = regionSpecs(r.role, r.axis, { ...box }, r.label ?? null, {
      id: r.id, layer: 'main', parent: r.parent ?? null, style: regionStyle(r, theme), fitted: r.fitted, fontFamily,
    });
    const marks = { ...(r.pinned ? { pinned: true } : {}), ...ownNodeStyle(r.colors) };
    if (Object.keys(marks).length === 0) return specs as DiagramSpec[];
    const [region, ...rest] = specs;
    return [{ ...region!, data: { ...region!.data, diagram: { ...region!.data.diagram, ...marks } as never } }, ...rest] as DiagramSpec[];
  });
}

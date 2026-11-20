/** The audit map's layout: a squarified treemap of the areas nested by their paths, sized by source files. */
import { areaTree, type AreaTreeNode } from './areaTree';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Sized<T> {
  readonly item: T;
  readonly area: number;
}

/** The worst aspect ratio among `row` laid along a side of length `side`. */
function worst(row: readonly Sized<unknown>[], side: number): number {
  const sum = row.reduce((n, r) => n + r.area, 0);
  const most = Math.max(...row.map((r) => r.area));
  const least = Math.min(...row.map((r) => r.area));
  const s2 = side * side;
  return Math.max((s2 * most) / (sum * sum), (sum * sum) / (s2 * least));
}

/**
 * Lay `items` out in `box` with Bruls, Huizing and van Wijk's squarified algorithm: each item's box has an area in
 * proportion to its value, and rows are kept as near square as the order allows. Items go largest first; one of
 * value 0 gets an empty box at the corner.
 */
export function squarify<T>(items: readonly { item: T; value: number }[], box: Box): (Box & { item: T })[] {
  const total = items.reduce((n, i) => n + Math.max(0, i.value), 0);
  const empty = (item: T) => ({ item, x: box.x, y: box.y, width: 0, height: 0 });
  if (total <= 0 || box.width <= 0 || box.height <= 0) return items.map((i) => empty(i.item));
  const scale = (box.width * box.height) / total;
  const rest: Sized<T>[] = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
    .map((i) => ({ item: i.item, area: i.value * scale }));
  const out: (Box & { item: T })[] = [];
  let { x, y, width, height } = box;
  let row: Sized<T>[] = [];
  const place = () => {
    const sum = row.reduce((n, r) => n + r.area, 0);
    if (width >= height) {
      const w = sum / height;
      let at = y;
      for (const r of row) {
        const h = r.area / w;
        out.push({ item: r.item, x, y: at, width: w, height: h });
        at += h;
      }
      x += w;
      width -= w;
    } else {
      const h = sum / width;
      let at = x;
      for (const r of row) {
        const w = r.area / h;
        out.push({ item: r.item, x: at, y, width: w, height: h });
        at += w;
      }
      y += h;
      height -= h;
    }
    row = [];
  };
  while (rest.length > 0) {
    const next = rest[0]!;
    const side = Math.min(width, height);
    if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
      row.push(next);
      rest.shift();
    } else place();
  }
  if (row.length > 0) place();
  return [...out, ...items.filter((i) => i.value <= 0).map((i) => empty(i.item))];
}

/** `box` with each edge moved inward by `by`, never past empty. */
export function inset(box: Box, by: number): Box {
  const width = Math.max(0, box.width - 2 * by);
  const height = Math.max(0, box.height - 2 * by);
  return { x: box.x + by, y: box.y + by, width, height };
}

/** `box` with its edges on whole pixels. */
export function snapped(box: Box): Box {
  const x0 = Math.round(box.x), y0 = Math.round(box.y);
  return { x: x0, y: y0, width: Math.round(box.x + box.width) - x0, height: Math.round(box.y + box.height) - y0 };
}

export interface MapFrame extends Box {
  /** Its path, the prefix its areas share: `core.domains`. */
  readonly name: string;
  /** The frame holding it, or null at the top. */
  readonly parent: string | null;
  /** 0 for a top-level package, one more for each frame around it. */
  readonly depth: number;
  readonly files: number;
  /** Whether it is big enough to carry its name above its areas. */
  readonly titled: boolean;
}

export interface MapCell extends Box {
  readonly id: string;
  /** The frame holding it, or null for an area at the top. */
  readonly parent: string | null;
}

/** How a frame is padded: outside, between its children, and above and below them, more above when it is titled, a
 *  top-level package more than a frame inside one. Never at its sides. */
export const MAP_PADDING = { outer: 2, inner: 1.5, title: 18, nestedPad: 1.5, nestedTitle: 15 } as const;

/** The title's height and the padding on a frame at `depth`. */
export const framePadOf = (depth: number) => (depth === 0
  ? { pad: MAP_PADDING.outer, title: MAP_PADDING.title }
  : { pad: MAP_PADDING.nestedPad, title: MAP_PADDING.nestedTitle });

const titledAt = (b: Box, depth: number) => (depth === 0 ? b.width > 40 && b.height > 40 : b.width > 40 && b.height > 36);

/** Every frame the areas' paths make and every area as one cell, nested, in a `width` × `height` box. */
export function layoutMap(
  areas: readonly { id: string; files: number }[],
  width: number,
  height: number,
): { frames: MapFrame[]; cells: MapCell[] } {
  const frames: MapFrame[] = [];
  const cells: MapCell[] = [];
  const place = (nodes: readonly AreaTreeNode[], box: Box, depth: number, parent: string | null) => {
    for (const placed of squarify(nodes.map((n) => ({ item: n, value: n.files })), box)) {
      const node = placed.item;
      if (node.kind === 'area') {
        cells.push({ id: node.id, parent, ...snapped(inset(placed, MAP_PADDING.inner / 2)) });
        continue;
      }
      // A frame takes no room at its sides, so the areas in neighboring frames space as they do within one.
      const frame = snapped({ ...placed, y: placed.y + MAP_PADDING.inner / 2, height: Math.max(0, placed.height - MAP_PADDING.inner) });
      const titled = titledAt(frame, depth);
      frames.push({ ...frame, name: node.name, parent, depth, files: node.files, titled });
      const { pad, title } = framePadOf(depth);
      const top = titled ? title : pad;
      place(node.children, { x: frame.x, y: frame.y + top, width: frame.width, height: frame.height - top - pad }, depth + 1, node.name);
    }
  };
  place(areaTree(areas), inset({ x: 0, y: 0, width, height }, MAP_PADDING.outer), 0, null);
  return { frames, cells };
}

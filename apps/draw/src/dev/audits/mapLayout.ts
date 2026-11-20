/** The audit map's layout: a squarified treemap of packages, each holding its areas, sized by source files. */

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
  readonly name: string;
  readonly files: number;
  /** Whether it is big enough to carry its name above its areas. */
  readonly titled: boolean;
}

export interface MapCell extends Box {
  readonly id: string;
}

/** How a package frame is padded: outside, between its areas, and above them when it is titled. */
export const MAP_PADDING = { outer: 2, inner: 1.5, title: 15 } as const;

const titledAt = (b: Box) => b.width > 46 && b.height > 40;

/** Every package as a frame and every area as a cell, in a `width` × `height` box. */
export function layoutMap(
  areas: readonly { id: string; group: string; files: number }[],
  width: number,
  height: number,
): { frames: MapFrame[]; cells: MapCell[] } {
  const groups = new Map<string, { id: string; files: number }[]>();
  for (const a of areas) {
    const list = groups.get(a.group) ?? [];
    list.push(a);
    groups.set(a.group, list);
  }
  const outer = inset({ x: 0, y: 0, width, height }, MAP_PADDING.outer);
  const placed = squarify([...groups].map(([name, list]) => ({ item: { name, list }, value: list.reduce((n, a) => n + a.files, 0) })), outer);
  const frames: MapFrame[] = [];
  const cells: MapCell[] = [];
  for (const g of placed) {
    const box = snapped(inset(g, MAP_PADDING.inner / 2));
    const titled = titledAt(box);
    frames.push({ ...box, name: g.item.name, files: g.item.list.reduce((n, a) => n + a.files, 0), titled });
    const top = titled ? MAP_PADDING.title : MAP_PADDING.outer;
    const inner = { x: box.x + MAP_PADDING.outer, y: box.y + top, width: box.width - 2 * MAP_PADDING.outer, height: box.height - top - MAP_PADDING.outer };
    for (const c of squarify(g.item.list.map((a) => ({ item: a.id, value: a.files })), inner)) {
      cells.push({ id: c.item, ...snapped(inset(c, MAP_PADDING.inner / 2)) });
    }
  }
  return { frames, cells };
}

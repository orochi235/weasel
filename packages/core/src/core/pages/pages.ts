import type { Bounds } from '@weasel-js/routing';

/** One page of a document: a sheet of a fixed size, in world units. */
export interface Page {
  readonly id: string;
  readonly name?: string;
  readonly width: number;
  readonly height: number;
}

/** A page and where it sits in world space. */
export interface PlacedPage extends Page {
  readonly x: number;
  readonly y: number;
  /** Its place in the document's page order. */
  readonly index: number;
}

/** Options for {@link layoutPages}. */
export interface PageLayoutOptions {
  /** Which way the pages run. Default `'row'`. */
  direction?: 'row' | 'column';
  /** World units between neighbors. Default 40. */
  gap?: number;
  /** Where a page sits across the run, against the largest page. Default `'start'`. */
  align?: 'start' | 'center' | 'end';
  /** Where the first page's run starts. Default the world origin. */
  origin?: { readonly x: number; readonly y: number };
}

const ALIGN = { start: 0, center: 0.5, end: 1 } as const;

/**
 * Place a document's pages in one world space, in order, so a single scene,
 * view, and history serve all of them. With the defaults the first page's
 * top-left corner is the world origin, where a one-page document's page is.
 * Throws on two pages with one id.
 */
export function layoutPages(pages: readonly Page[], options: PageLayoutOptions = {}): PlacedPage[] {
  const { direction = 'row', gap = 40, align = 'start', origin = { x: 0, y: 0 } } = options;
  const row = direction === 'row';
  const across = Math.max(0, ...pages.map((p) => (row ? p.height : p.width)));
  const seen = new Set<string>();
  let along = 0;
  return pages.map((page, index) => {
    if (seen.has(page.id)) throw new Error(`layoutPages: two pages have the id "${page.id}"`);
    seen.add(page.id);
    const offset = (across - (row ? page.height : page.width)) * ALIGN[align];
    const placed = {
      ...page,
      x: origin.x + (row ? along : offset),
      y: origin.y + (row ? offset : along),
      index,
    };
    along += (row ? page.width : page.height) + gap;
    return placed;
  });
}

/** The name page `index` of the page order shows: its own, else "Page" and its place. */
export function pageName(page: { readonly name?: string | undefined }, index: number): string {
  return page.name ?? `Page ${index + 1}`;
}

/** The page under a world point, or `null` between and outside them. A point on an edge is on the page. */
export function pageAt(
  pages: readonly PlacedPage[],
  point: { readonly x: number; readonly y: number },
): PlacedPage | null {
  return pageOfBounds(pages, { x: point.x, y: point.y, width: 0, height: 0 });
}

function overlap(page: PlacedPage, b: Bounds): number | null {
  const w = Math.min(page.x + page.width, b.x + b.width) - Math.max(page.x, b.x);
  const h = Math.min(page.y + page.height, b.y + b.height) - Math.max(page.y, b.y);
  return w < 0 || h < 0 ? null : w * h;
}

/**
 * The page a world-space box belongs to: the one it overlaps most, the earlier
 * of two it overlaps equally, and `null` when it touches none. This is the
 * rule that says which page an object is on.
 */
export function pageOfBounds(pages: readonly PlacedPage[], bounds: Bounds): PlacedPage | null {
  let best: PlacedPage | null = null;
  let most = -1;
  for (const page of pages) {
    const area = overlap(page, bounds);
    if (area !== null && area > most) {
      best = page;
      most = area;
    }
  }
  return best;
}

/**
 * The page `step` places along the page order from the one with id `current`:
 * the next slide is `1`, the one before is `-1`. `null` past either end, unless
 * `wrap`. With no current page in the list, a step forward starts at the first
 * page and a step back at the last.
 */
export function adjacentPage(
  pages: readonly PlacedPage[],
  current: string | null,
  step: number,
  options: { wrap?: boolean } = {},
): PlacedPage | null {
  const n = pages.length;
  if (n === 0) return null;
  const at = pages.findIndex((p) => p.id === current);
  if (at < 0) return pages[step < 0 ? n - 1 : 0] ?? null;
  const to = at + step;
  return pages[options.wrap ? ((to % n) + n) % n : to] ?? null;
}

/** The box around every page, or `null` for a document with none. */
export function pagesBounds(pages: readonly PlacedPage[]): Bounds | null {
  if (pages.length === 0) return null;
  const x = Math.min(...pages.map((p) => p.x));
  const y = Math.min(...pages.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...pages.map((p) => p.x + p.width)) - x,
    height: Math.max(...pages.map((p) => p.y + p.height)) - y,
  };
}

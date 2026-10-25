import { describe, expect, it } from 'vitest';
import { adjacentPage, layoutPages, pageAt, pageHolding, pageName, pageOfBounds, pagesBounds, type Page } from './pages';
import { pagesLayer } from './pagesLayer';
import { fitViewToPage, pageInView } from './fitViewToPage';

const A: Page = { id: 'a', width: 100, height: 200 };
const B: Page = { id: 'b', name: 'Back', width: 300, height: 100 };
const C: Page = { id: 'c', width: 50, height: 50 };

const rects = (pages: readonly Page[], options?: Parameters<typeof layoutPages>[1]) =>
  layoutPages(pages, options).map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));

describe('layoutPages', () => {
  it('puts the first page at the origin and the rest in a row, a gap apart', () => {
    expect(rects([A, B, C], { gap: 10 })).toEqual([
      { id: 'a', x: 0, y: 0, width: 100, height: 200 },
      { id: 'b', x: 110, y: 0, width: 300, height: 100 },
      { id: 'c', x: 420, y: 0, width: 50, height: 50 },
    ]);
  });

  it('stacks a column, and aligns across it', () => {
    expect(rects([A, B, C], { direction: 'column', gap: 20, align: 'center' })).toEqual([
      { id: 'a', x: 100, y: 0, width: 100, height: 200 },
      { id: 'b', x: 0, y: 220, width: 300, height: 100 },
      { id: 'c', x: 125, y: 340, width: 50, height: 50 },
    ]);
    expect(rects([A, B], { direction: 'row', gap: 0, align: 'end' }).map((p) => p.y)).toEqual([0, 100]);
  });

  it('starts from an origin, and keeps each page and its index', () => {
    const placed = layoutPages([A, B], { gap: 0, origin: { x: 5, y: 7 } });
    expect(placed.map((p) => [p.x, p.y, p.index])).toEqual([[5, 7, 0], [105, 7, 1]]);
    expect(placed[1]?.name).toBe('Back');
    expect(layoutPages([])).toEqual([]);
  });

  it('refuses two pages with one id', () => {
    expect(() => layoutPages([A, { ...B, id: 'a' }])).toThrow(/"a"/);
  });
});

describe('finding a page', () => {
  const placed = layoutPages([A, B, C], { gap: 10 });

  it('answers the page under a point, and null in a gap', () => {
    expect(pageAt(placed, { x: 50, y: 150 })?.id).toBe('a');
    expect(pageAt(placed, { x: 110, y: 0 })?.id).toBe('b');
    expect(pageAt(placed, { x: 105, y: 10 })).toBeNull();
    expect(pageAt(placed, { x: 150, y: 150 })).toBeNull();
  });

  it('answers the page a box overlaps most, the earlier of two that tie, and null for none', () => {
    expect(pageOfBounds(placed, { x: 90, y: 0, width: 100, height: 50 })?.id).toBe('b');
    expect(pageOfBounds(placed, { x: 80, y: 0, width: 50, height: 50 })?.id).toBe('a');
    expect(pageOfBounds(placed, { x: 0, y: 300, width: 10, height: 10 })).toBeNull();
    expect(pageOfBounds(placed, { x: 50, y: 50, width: 0, height: 0 })?.id).toBe('a');
  });

  it('bounds every page, and nothing when there are none', () => {
    expect(pagesBounds(placed)).toEqual({ x: 0, y: 0, width: 470, height: 200 });
    expect(pagesBounds([])).toBeNull();
  });
});

describe('adjacentPage', () => {
  const placed = layoutPages([A, B, C]);

  it('steps through the page order, and stops at either end', () => {
    expect(adjacentPage(placed, 'a', 1)?.id).toBe('b');
    expect(adjacentPage(placed, 'c', -2)?.id).toBe('a');
    expect(adjacentPage(placed, 'c', 1)).toBeNull();
    expect(adjacentPage(placed, 'a', -1)).toBeNull();
  });

  it('wraps when asked', () => {
    expect(adjacentPage(placed, 'c', 1, { wrap: true })?.id).toBe('a');
    expect(adjacentPage(placed, 'a', -4, { wrap: true })?.id).toBe('c');
  });

  it('starts from the first page, or the last going back, when the current one is not in the list', () => {
    expect(adjacentPage(placed, null, 1)?.id).toBe('a');
    expect(adjacentPage(placed, 'gone', -1)?.id).toBe('c');
    expect(adjacentPage([], null, 1)).toBeNull();
  });
});

describe('pagesLayer', () => {
  it('paints one filled rect per page, in world space', () => {
    const placed = layoutPages([A, B], { gap: 10 });
    const layer = pagesLayer(placed, { fill: '#ffffff' });
    const commands = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 10, height: 10, dpr: 1 });
    expect(commands).toEqual([
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 100, height: 200 }, fill: { paint: { kind: 'solid', color: '#ffffff' } } },
      { kind: 'path', path: { kind: 'rect', x: 110, y: 0, width: 300, height: 100 }, fill: { paint: { kind: 'solid', color: '#ffffff' } } },
    ]);
    expect(layer.space ?? 'world').toBe('world');
  });

  it('takes a fill per page', () => {
    const placed = layoutPages([A, B]);
    const layer = pagesLayer(placed, { fill: (page) => (page.id === 'a' ? '#111111' : '#222222') });
    const fills = layer
      .draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 10, height: 10, dpr: 1 })
      .map((c) => (c.kind === 'path' ? c.fill : null));
    expect(fills).toEqual([
      { paint: { kind: 'solid', color: '#111111' } },
      { paint: { kind: 'solid', color: '#222222' } },
    ]);
  });
});

describe('fitViewToPage', () => {
  it('fits the view to one placed page', () => {
    const [, b] = layoutPages([A, B], { gap: 10 });
    const view = fitViewToPage(b!, { width: 300, height: 100 }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { padding: 0 });
    expect(view.scale).toEqual({ x: 1, y: 1 });
    expect([view.x, view.y]).toEqual([110, 0]);
  });
});

describe('pageInView', () => {
  const pages = layoutPages([A, B], { gap: 10 });
  it('answers the page the view shows most of', () => {
    expect(pageInView(pages, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 })?.id).toBe('a');
    expect(pageInView(pages, { x: 60, y: 0, scale: { x: 2, y: 2 } }, { width: 200, height: 100 })?.id).toBe('b');
  });

  it('answers null when the view shows no page', () => {
    expect(pageInView(pages, { x: -500, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 })).toBeNull();
  });
});

describe('pageName', () => {
  it('is the page’s own name, else "Page" and its place', () => {
    expect(pageName({ name: 'Intro' }, 3)).toBe('Intro');
    expect(pageName({}, 1)).toBe('Page 2');
  });
});

describe('pageHolding', () => {
  const PAGES = layoutPages([{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }]);
  it('is the page a box is on, when it is on one', () => {
    expect(pageHolding(PAGES, { x: 20, y: 20, width: 40, height: 30 })?.id).toBe('p1');
  });
  it('puts a box in the gap on the nearer page', () => {
    expect(pageHolding(PAGES, { x: 230, y: 20, width: 5, height: 30 })?.id).toBe('p2');
    expect(pageHolding(PAGES, { x: 203, y: 20, width: 5, height: 30 })?.id).toBe('p1');
  });
  it('takes the earlier page when a gap box is equally near both', () => {
    expect(pageHolding(PAGES, { x: 215, y: 20, width: 10, height: 30 })?.id).toBe('p1');
  });
  it('is null with no pages', () => {
    expect(pageHolding([], { x: 0, y: 0, width: 1, height: 1 })).toBeNull();
  });
});

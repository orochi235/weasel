import { describe, it, expect } from 'vitest';
import { createViewResolver, type ResolvableView } from './viewResolver';
import type { View } from 'core/viewport/view';

const ROOT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const CANVAS = { left: 100, top: 50 };

function viewAt(id: string, x: number, y: number): ResolvableView {
  return {
    id,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    rect: { x, y, w: 100, h: 100 },
  };
}

/** Two viewports side by side: A at canvas (0,0), B at canvas (200,0). */
function resolver(views: ResolvableView[] = [viewAt('a', 0, 0), viewAt('b', 200, 0)]) {
  let live = views;
  return {
    r: createViewResolver({
      views: () => live,
      root: () => ROOT,
      toLocal: (x, y) => ({ x: x - CANVAS.left, y: y - CANVAS.top }),
    }),
    setViews: (next: ResolvableView[]) => { live = next; },
  };
}

/** Client coords for a point at canvas-space (x, y). */
const client = (x: number, y: number) => [CANVAS.left + x, CANVAS.top + y] as const;

describe('view resolution', () => {
  it('picks the view whose rect contains the point', () => {
    const { r } = resolver();
    expect(r.at(null, ...client(250, 50)).id).toBe('b');
  });

  it('reports the point in the world of the view it resolved to', () => {
    const { r } = resolver([viewAt('a', 0, 0), { ...viewAt('b', 200, 0), view: { x: 1000, y: 0, scale: { x: 2, y: 2 } } }]);
    expect(r.at(null, ...client(250, 50)).world).toEqual({ x: 1025, y: 25 });
  });

  it('reads the canvas through `toLocal`, whatever maps a client point onto it', () => {
    // A canvas drawn at double size: two client pixels to each of its own.
    const r = createViewResolver({
      views: () => [viewAt('a', 0, 0), viewAt('b', 200, 0)],
      root: () => ROOT,
      toLocal: (x, y) => ({ x: (x - CANVAS.left) / 2, y: (y - CANVAS.top) / 2 }),
    });
    const target = r.at(null, CANVAS.left + 500, CANVAS.top + 100);
    expect(target.id).toBe('b');
    expect(target.world).toEqual({ x: 50, y: 50 });
  });

  it('falls back to the root view outside every rect', () => {
    const { r } = resolver();
    const target = r.at(null, ...client(150, 50));
    expect(target.id).toBeNull();
    expect(target.view).toBe(ROOT);
    expect(target.world).toEqual({ x: 150, y: 50 });
  });

  it('picks the last overlapping view, matching paint order', () => {
    const { r } = resolver([viewAt('under', 0, 0), viewAt('over', 50, 50)]);
    expect(r.at(null, ...client(60, 60)).id).toBe('over');
  });

  it('treats the right and bottom edges as exclusive', () => {
    const { r } = resolver();
    expect(r.at(null, ...client(100, 50)).id).toBeNull();
    expect(r.at(null, ...client(50, 100)).id).toBeNull();
    expect(r.at(null, ...client(99, 99)).id).toBe('a');
  });
});

describe('gesture stickiness', () => {
  it('keeps a captured pointer on the view it started in', () => {
    const { r } = resolver();
    expect(r.begin(1, ...client(50, 50)).id).toBe('a');
    // Dragged clear across B's rect, and off the canvas entirely.
    expect(r.at(1, ...client(250, 50)).id).toBe('a');
    expect(r.at(1, ...client(-999, -999)).id).toBe('a');
  });

  it('keeps a pointer that began on the root canvas out of every view', () => {
    const { r } = resolver();
    expect(r.begin(1, ...client(150, 50)).id).toBeNull();
    expect(r.at(1, ...client(50, 50)).id).toBeNull();
  });

  it('reports the pinned view its current rect, not the one it began with', () => {
    const { r, setViews } = resolver();
    r.begin(1, ...client(50, 50));
    setViews([{ ...viewAt('a', 0, 0), rect: { x: 20, y: 20, w: 100, h: 100 } }]);
    expect(r.at(1, ...client(50, 50)).world).toEqual({ x: 30, y: 30 });
  });

  it('releases the pin on end', () => {
    const { r } = resolver();
    r.begin(1, ...client(50, 50));
    r.end(1);
    expect(r.at(1, ...client(250, 50)).id).toBe('b');
  });

  it('pins each pointer independently', () => {
    const { r } = resolver();
    r.begin(1, ...client(50, 50));
    r.begin(2, ...client(250, 50));
    expect(r.at(1, ...client(250, 50)).id).toBe('a');
    expect(r.at(2, ...client(50, 50)).id).toBe('b');
  });

  it('resolves fresh when the pinned view is gone', () => {
    const { r, setViews } = resolver();
    r.begin(1, ...client(50, 50));
    setViews([viewAt('b', 200, 0)]);
    expect(r.at(1, ...client(250, 50)).id).toBe('b');
  });

  it('drops every pin on clear', () => {
    const { r } = resolver();
    r.begin(1, ...client(50, 50));
    r.begin(2, ...client(50, 50));
    r.clear();
    expect(r.at(1, ...client(250, 50)).id).toBe('b');
    expect(r.at(2, ...client(250, 50)).id).toBe('b');
  });
});

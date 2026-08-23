import { describe, it, expect } from 'vitest';
import { createViewResolver, type ResolvableView } from './viewResolver';
import { createViewportLayer } from './viewportLayer';
import { clientToWorld } from 'core/viewport/clientToWorld';
import type { RenderLayer } from 'core/layers/render';
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
      canvasOrigin: () => CANVAS,
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

  it('reports the view rect origin in client space', () => {
    const { r } = resolver();
    expect(r.at(null, ...client(250, 50)).origin).toEqual({ left: 300, top: 50 });
  });

  it('falls back to the root view outside every rect', () => {
    const { r } = resolver();
    const target = r.at(null, ...client(150, 50));
    expect(target.id).toBeNull();
    expect(target.view).toBe(ROOT);
    expect(target.origin).toEqual(CANVAS);
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
    expect(r.at(1, ...client(50, 50)).origin).toEqual({ left: 120, top: 70 });
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

describe('routing a viewport layer', () => {
  const EMPTY: RenderLayer<unknown> = { id: 'src', label: 'src', space: 'world', draw: () => [] };
  const DIMS = { width: 600, height: 400 };

  const pip = createViewportLayer<unknown>({
    id: 'pip',
    label: 'PiP',
    source: [EMPTY],
    view: { x: 250, y: 200, scale: { x: 1.6, y: 1.6 } },
    bounds: () => ({ x: 8, y: 232, w: 240, h: 160 }),
  });

  it('lands a client point where the layer says it reprojects', () => {
    const r = createViewResolver({
      views: () => [pip.resolvable(ROOT, DIMS)],
      root: () => ROOT,
      canvasOrigin: () => CANVAS,
    });
    const [cx, cy] = client(88, 312);
    const t = r.at(null, cx, cy);
    expect(t.id).toBe('pip');
    // The resolver's origin fed to clientToWorld must agree with the layer's
    // own inverse — they are two paths to the same inner world point.
    expect(clientToWorld(cx, cy, t.origin, t.view))
      .toEqual([pip.reproject(ROOT, DIMS, { x: 88, y: 312 })!.x,
                pip.reproject(ROOT, DIMS, { x: 88, y: 312 })!.y]);
  });
});

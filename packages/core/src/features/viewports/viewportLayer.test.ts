import { describe, it, expect } from 'vitest';
import { createViewportLayer, type ViewportLayer } from './viewportLayer';
import { createViewResolver } from './viewResolver';
import { clientToWorld } from 'core/viewport/clientToWorld';
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { GroupDrawCommand } from '../../renderer';
import { viewToMat3 } from '../../renderer';
import { mat3, type GlMat3 } from '../../renderer/math/mat3';

const OUTER: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 600, height: 400 };

/** Source that draws nothing — routing is pure geometry. */
const EMPTY_SOURCE: RenderLayer<unknown> = {
  id: 'src', label: 'src', space: 'world', draw: () => [],
};

/** The demo's PiP: 240x160 at bottom-left, 1.6x, showing world from (250, 200). */
function pip() {
  return createViewportLayer<unknown>({
    id: 'pip',
    label: 'PiP',
    source: [EMPTY_SOURCE],
    view: { x: 250, y: 200, scale: { x: 1.6, y: 1.6 } },
    bounds: (_outer, dims) => ({ x: 8, y: dims.height - 168, w: 240, h: 160 }),
  });
}

/** Where a screen point lands when `layers` are routed the way `<CanvasView>`
 *  routes them: `resolvable` fed to a view resolver, then `clientToWorld`.
 *  The canvas sits at the client origin, so client and screen coincide. */
function route(
  layers: readonly ViewportLayer<unknown>[],
  screen: { x: number; y: number },
  dims = DIMS,
): { id: string | null; point: { x: number; y: number } } {
  const r = createViewResolver({
    views: () => layers.map((l) => l.resolvable(OUTER, dims)),
    root: () => OUTER,
    canvasOrigin: () => ({ left: 0, top: 0 }),
  });
  const t = r.at(null, screen.x, screen.y);
  const [x, y] = clientToWorld(screen.x, screen.y, t.origin, t.view);
  return { id: t.id, point: { x, y } };
}

describe('routing through a viewport', () => {
  it('maps the rect top-left to the inner view origin', () => {
    expect(route([pip()], { x: 8, y: 232 })).toEqual({ id: 'pip', point: { x: 250, y: 200 } });
  });

  it('divides by the inner scale', () => {
    // 160 screen px right of the rect's left edge, at 1.6x → 100 world units.
    expect(route([pip()], { x: 168, y: 232 }).point).toEqual({ x: 350, y: 200 });
  });

  it('round-trips against the mapping the layer draws with', () => {
    const inner = { x: 250, y: 200, scale: 1.6 };
    const b = { x: 8, y: 232 };
    for (const world of [{ x: 300, y: 250 }, { x: 260.5, y: 205.25 }, { x: 399, y: 299 }]) {
      const screen = {
        x: (world.x - inner.x) * inner.scale + b.x,
        y: (world.y - inner.y) * inner.scale + b.y,
      };
      const back = route([pip()], screen).point;
      expect(back.x).toBeCloseTo(world.x);
      expect(back.y).toBeCloseTo(world.y);
    }
  });

  it('leaves points outside the rect to the outer view', () => {
    const layer = pip();
    expect(route([layer], { x: 7, y: 232 }).id).toBeNull();   // left
    expect(route([layer], { x: 8, y: 231 }).id).toBeNull();   // above
    expect(route([layer], { x: 248, y: 300 }).id).toBeNull(); // right edge is exclusive
    expect(route([layer], { x: 100, y: 392 }).id).toBeNull(); // bottom edge is exclusive
  });

  it('tracks bounds that move with the canvas size', () => {
    const layer = pip();
    // Same rect-relative point, taller canvas → the rect follows the bottom edge.
    const tall = { width: 600, height: 500 };
    expect(route([layer], { x: 8, y: 332 }, tall)).toEqual({ id: 'pip', point: { x: 250, y: 200 } });
    // The rect moved down with the bottom edge, so the old origin is now above it.
    expect(route([layer], { x: 8, y: 232 }, tall).id).toBeNull();
  });

  it('picks the last overlapping viewport, matching paint order', () => {
    const a = createViewportLayer<unknown>({
      id: 'a', label: 'a', source: [EMPTY_SOURCE],
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      bounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
    });
    const b = createViewportLayer<unknown>({
      id: 'b', label: 'b', source: [EMPTY_SOURCE],
      view: { x: 500, y: 500, scale: { x: 1, y: 1 } },
      bounds: () => ({ x: 50, y: 50, w: 100, h: 100 }),
    });
    expect(route([a, b], { x: 60, y: 60 })).toEqual({ id: 'b', point: { x: 510, y: 510 } });
    expect(route([a, b], { x: 10, y: 10 })).toEqual({ id: 'a', point: { x: 10, y: 10 } });
  });

  it('normalizes a thunked inner view with a zero scale to a finite one', () => {
    const layer = createViewportLayer<unknown>({
      id: 'z',
      label: 'z',
      source: [EMPTY_SOURCE],
      view: () => ({ x: 0, y: 0, scale: { x: 0, y: 0 } }),
      bounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
    });
    const { point } = route([layer], { x: 10, y: 10 });
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
  });
});

describe('viewport draw', () => {
  const INNER: View = { x: 250, y: 200, scale: { x: 1.6, y: 1.6 } };
  const BOUNDS = { x: 8, y: 232, w: 240, h: 160 };

  /** Emits one world-space unit rect at the world origin. */
  const MARKER: RenderLayer<unknown> = {
    id: 'marker', label: 'marker', space: 'world',
    draw: () => [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { fill: 'solid', color: '#000' },
    }],
  };

  function viewportOf(source: RenderLayer<unknown>[]) {
    return createViewportLayer<unknown>({
      id: 'v', label: 'v', source, view: INNER, bounds: () => BOUNDS,
    });
  }

  function outerGroup(source: RenderLayer<unknown>[]): GroupDrawCommand {
    const [group] = viewportOf(source).draw(undefined, OUTER, DIMS);
    return group as GroupDrawCommand;
  }

  it('applies the inner view to world-space source layers', () => {
    const inner = outerGroup([MARKER]).children[0] as GroupDrawCommand;
    expect(inner.kind).toBe('group');
    expect(Array.from(inner.transform!)).toEqual(Array.from(viewToMat3(INNER)));
  });

  it('passes screen-space source layers through untransformed', () => {
    const hud: RenderLayer<unknown> = { ...MARKER, id: 'hud', space: 'screen' };
    expect(outerGroup([hud]).children.map((c) => c.kind)).toEqual(['path']);
  });

  it('hands source layers the data its own `data` thunk returns', () => {
    const seen: unknown[] = [];
    const probe: RenderLayer<{ who: string }> = {
      id: 'probe', label: 'probe', space: 'screen',
      draw: (data) => { seen.push(data); return []; },
    };
    const layer = createViewportLayer<{ who: string }, { who: string }>({
      id: 'v', label: 'v', source: [probe], view: INNER, bounds: () => BOUNDS,
      data: (outer) => ({ who: `inner of ${outer.who}` }),
    });
    layer.draw({ who: 'outer' }, OUTER, DIMS);
    expect(seen).toEqual([{ who: 'inner of outer' }]);
  });

  it('re-reads a thunked inner view every draw', () => {
    let camera: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const layer = createViewportLayer<unknown>({
      id: 'v', label: 'v', source: [MARKER], view: () => camera, bounds: () => BOUNDS,
    });
    const transformOf = () => {
      const [group] = layer.draw(undefined, OUTER, DIMS);
      const inner = (group as GroupDrawCommand).children[0] as GroupDrawCommand;
      return Array.from(inner.transform!);
    };
    expect(transformOf()).toEqual(Array.from(viewToMat3(camera)));
    camera = INNER;
    expect(transformOf()).toEqual(Array.from(viewToMat3(INNER)));
  });

  it('routes against the thunked view the frame was drawn with', () => {
    let camera: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const layer = createViewportLayer<unknown>({
      id: 'v', label: 'v', source: [MARKER], view: () => camera, bounds: () => BOUNDS,
    });
    expect(route([layer], { x: BOUNDS.x, y: BOUNDS.y }).point).toEqual({ x: 0, y: 0 });
    camera = INNER;
    expect(route([layer], { x: BOUNDS.x, y: BOUNDS.y }).point).toEqual({ x: 250, y: 200 });
    expect(layer.resolvable(OUTER, DIMS).view).toBe(INNER);
  });

  it('passes the outer data through when no thunk is given', () => {
    const seen: unknown[] = [];
    const probe: RenderLayer<{ who: string }> = {
      id: 'probe', label: 'probe', space: 'screen',
      draw: (data) => { seen.push(data); return []; },
    };
    const layer = createViewportLayer<{ who: string }>({
      id: 'v', label: 'v', source: [probe], view: INNER, bounds: () => BOUNDS,
    });
    layer.draw({ who: 'outer' }, OUTER, DIMS);
    expect(seen).toEqual([{ who: 'outer' }]);
  });

  it('draws a world point where routing says it lands', () => {
    const group = outerGroup([MARKER]);
    const inner = group.children[0] as GroupDrawCommand;
    const composed = mat3.multiply(new Float32Array(group.transform!) as GlMat3, inner.transform!);
    const world = { x: 300, y: 250 };
    const [sx, sy] = mat3.apply(composed, world.x, world.y);
    const back = route([viewportOf([MARKER])], { x: sx, y: sy }).point;
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });
});

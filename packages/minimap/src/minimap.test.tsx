/**
 * The minimap as one ambient entry: its input moves the main camera and only
 * the main camera, its chrome paints only where it belongs, and the linked
 * crosshair repaints as the pointer moves.
 *
 * jsdom has no GL, so these assert camera writes and paint-gating decisions;
 * the picture itself is checked by `tests/visual`.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from '@weasel-js/core';
import { createScene, wheelZoomFactor } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import type { CanvasExtensionApi } from '@weasel-js/core';
import type { ViewApi } from '@weasel-js/core';
import type { ContributionDepReader, PathDrawCommand, RenderLayer, SurfaceContribution } from '@weasel-js/core';
import { createPointerStore } from '@weasel-js/routing/react';
import { createMinimapContribution, createLinkedCursorContribution } from './createMinimapContribution';
import { createIndicatorLayer, createLinkedCursorLayer } from './layers';
import { computeIndicatorCommand } from './minimapMath';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const ROOT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
/** Scene spans world (0,0)–(1000,800). Fit into 100×80 with 8px padding:
 *  scale 0.08, camera at (-125, -100). */
const RECT = { x: 0, y: 0, w: 100, h: 80 };
const FIT: View = { x: -125, y: -100, scale: { x: 0.08, y: 0.08 } };

const widthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const heightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  // The root camera's host is 400×300, so "centered" has a center.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });
});
afterAll(() => {
  if (widthDesc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDesc);
  if (heightDesc) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDesc);
});

function pointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }));
}

function mount(fit?: 'live', more: Partial<Parameters<typeof createMinimapContribution>[0]> = {}) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  scene.add({ kind: 'mark', layer: 'main', pose: { x: 990, y: 790, width: 10, height: 10 }, data: { kind: 'rect' } });
  const onViewChange = vi.fn();
  const minimap = createMinimapContribution({ rect: RECT, ...(fit ? { fit } : {}), ...more });
  const r = render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} onViewChange={onViewChange} ambient={[minimap]} />,
  );
  return { scene, onViewChange, canvas: r.container.querySelector('canvas')! };
}

const last = (fn: ReturnType<typeof vi.fn>): View => fn.mock.calls.at(-1)![0] as View;

describe('input in the minimap', () => {
  it('frames the scene through its fit camera', () => {
    const h = mount();
    // Minimap (10, 8) is the scene's own origin; centered in 400×300 is (-200, -150).
    act(() => {
      pointer(h.canvas, 'pointerdown', 10, 8);
      pointer(h.canvas, 'pointerup', 10, 8);
    });
    expect(last(h.onViewChange).x).toBeCloseTo(-200);
    expect(last(h.onViewChange).y).toBeCloseTo(-150);
  });

  it('reframes on a pose override under fit: "live"', () => {
    const h = mount('live');
    // The far corner moves in, so the scene spans half the width it did and
    // minimap (10, 8) is no longer the scene's origin.
    act(() => {
      h.scene.overrides.set(h.scene.roots[1], { pose: { x: 490, y: 790, width: 10, height: 10 } });
      pointer(h.canvas, 'pointerdown', 10, 8);
      pointer(h.canvas, 'pointerup', 10, 8);
    });
    expect(last(h.onViewChange).x).not.toBeCloseTo(-200);
  });

  it('centers the main camera on the pressed world point', () => {
    const h = mount();
    // Minimap (50, 40) is world (500, 400); centered in 400×300 is (300, 250).
    act(() => {
      pointer(h.canvas, 'pointerdown', 50, 40);
      pointer(h.canvas, 'pointerup', 50, 40);
    });
    expect(last(h.onViewChange)).toMatchObject({ x: 300, y: 250, scale: { x: 1, y: 1 } });
  });

  it('follows a drag, and leaves the minimap camera and selection alone', () => {
    const h = mount();
    act(() => {
      pointer(h.canvas, 'pointerdown', 50, 40);
      pointer(h.canvas, 'pointermove', 55, 40);
      pointer(h.canvas, 'pointermove', 60, 40);
      pointer(h.canvas, 'pointerup', 60, 40);
    });
    // Minimap x 60 is world 625; centered, 425.
    expect(last(h.onViewChange).x).toBeCloseTo(425);
    expect(h.scene.getSelection()).toEqual([]);
    // The same press lands on the same world point: the drag did not move the minimap's camera.
    act(() => {
      pointer(h.canvas, 'pointerdown', 50, 40);
      pointer(h.canvas, 'pointerup', 50, 40);
    });
    expect(last(h.onViewChange)).toMatchObject({ x: 300, y: 250 });
  });

  it('zooms the main camera on a wheel, about the world point under the cursor, as <MinimapCanvas> does', () => {
    const h = mount();
    // Minimap (50, 40) is world (500, 400), at (500, 400) in the main view.
    act(() => { h.canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 50, clientY: 40, deltaY: -100 })); });
    const next = last(h.onViewChange);
    expect(next.scale.x).toBeCloseTo(wheelZoomFactor(-100));
    expect((500 - next.x) * next.scale.x).toBeCloseTo(500);
    expect((400 - next.y) * next.scale.y).toBeCloseTo(400);
  });

  it('zooms the main camera on a Safari trackpad pinch, about the world point under it', () => {
    const h = mount();
    const gesture = (type: string, scale: number) => {
      const ev = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        scale, rotation: 0, clientX: 50, clientY: 40, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      });
      act(() => { h.canvas.dispatchEvent(ev); });
    };
    gesture('gesturestart', 1);
    gesture('gesturechange', 2);
    gesture('gestureend', 2);
    const next = last(h.onViewChange);
    expect(next.scale.x).toBeCloseTo(2);
    expect((500 - next.x) * next.scale.x).toBeCloseTo(500);
    expect((400 - next.y) * next.scale.y).toBeCloseTo(400);
  });

  it('zooms the main camera on a two-finger touch pinch, about the world point between the fingers', () => {
    // Away from the canvas origin, so the fingers are read in the minimap's own space: its (50, 40) is world (500, 400).
    const h = mount(undefined, { rect: { ...RECT, x: 200, y: 100 } });
    const touch = (type: string, pointerId: number, x: number) => act(() => {
      h.canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: 'touch', clientX: x, clientY: 140, button: 0, buttons: 1,
      }));
    });
    touch('pointerdown', 1, 240);
    touch('pointerdown', 2, 260);
    // Spread 20 → 30, centroid minimap x 50 → 55, world 500 → 562.5, which takes world 500's place in the main view.
    touch('pointermove', 2, 270);
    const next = last(h.onViewChange);
    expect(next.scale.x).toBeCloseTo(1.5);
    expect((562.5 - next.x) * next.scale.x).toBeCloseTo(500);
    expect((400 - next.y) * next.scale.y).toBeCloseTo(400);
  });

  it('clamps a wheel zoom to the limits it is given, and leaves the main camera alone with zoom: false', () => {
    const wheel = (canvas: HTMLCanvasElement) => act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 50, clientY: 40, deltaY: -5000 }));
    });
    const clamped = mount(undefined, { zoom: { max: 2.5 } });
    wheel(clamped.canvas);
    expect(last(clamped.onViewChange).scale.x).toBe(2.5);
    const off = mount(undefined, { zoom: false });
    wheel(off.canvas);
    expect(off.onViewChange.mock.calls.every(([v]) => (v as View).scale.x === 1)).toBe(true);
  });

  it('leaves a drag on the main canvas to the active tool', () => {
    const h = mount();
    act(() => {
      pointer(h.canvas, 'pointerdown', 300, 200);
      pointer(h.canvas, 'pointermove', 320, 210);
      pointer(h.canvas, 'pointermove', 340, 220);
      pointer(h.canvas, 'pointerup', 340, 220);
    });
    expect(h.onViewChange).not.toHaveBeenCalled();
  });
});

describe('minimap chrome', () => {
  const root: ViewApi = {
    get: () => ({ x: 100, y: 50, scale: { x: 2, y: 2 } }),
    set: () => {},
    hostSize: () => ({ width: 400, height: 300 }),
  };

  it('paints the indicator only in its own view, as the root camera\'s visible rect', () => {
    const layer = createIndicatorLayer({ viewId: 'minimap', root: () => root });
    expect(layer.draw({ viewId: null }, FIT, { width: 400, height: 300, dpr: 1 })).toEqual([]);
    const [cmd] = layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80, dpr: 1 });
    expect(cmd).toMatchObject({ kind: 'path', path: { kind: 'rect', x: 100, y: 50, width: 200, height: 150 } });
    // One screen pixel at the minimap's 0.08 scale.
    expect((cmd as { stroke: { width: number } }).stroke.width).toBeCloseTo(12.5);
  });

  it('draws the same command computeIndicatorCommand builds, in a mirrored minimap too', () => {
    const layer = createIndicatorLayer({ viewId: 'minimap', root: () => root, style: { width: 2 } });
    const mirrored = { x: 0, y: 0, scale: { x: -0.08, y: 0.08 } };
    const [cmd] = layer.draw({ viewId: 'minimap' }, mirrored, { width: 100, height: 80, dpr: 1 });
    expect(cmd).toEqual(computeIndicatorCommand(root.get(), { width: 400, height: 300 }, { width: 2 }, mirrored));
    expect((cmd as { stroke: { width: number } }).stroke.width).toBeCloseTo(25);
  });

  it('strokes the indicator in the theme\'s accent, following a theme change, unless its style names a stroke', async () => {
    const strokeOf = (layer: RenderLayer<unknown>) =>
      (layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80, dpr: 1 })[0] as PathDrawCommand).stroke?.paint;
    const host = document.body.appendChild(document.createElement('div'));
    const element = host.appendChild(document.createElement('canvas'));
    element.style.setProperty('--wzl-accent', '#123456');
    const api = { element, requestRedraw: vi.fn() } as unknown as CanvasExtensionApi;
    const reader = { get: (k: string) => (k === 'rootView' ? root : undefined) } as unknown as ContributionDepReader;
    const themed = createMinimapContribution({ rect: RECT });
    const styled = createMinimapContribution({ rect: RECT, indicatorStyle: { stroke: '#ff00aa' } });
    const detach = [themed.attach!(api, reader), styled.attach!(api, reader)];
    const indicatorOf = (c: SurfaceContribution) => (c.overlay as RenderLayer<unknown>[])[0]!;
    expect(strokeOf(indicatorOf(themed))).toEqual({ kind: 'solid', color: '#123456' });
    expect(strokeOf(indicatorOf(styled))).toEqual({ kind: 'solid', color: '#ff00aa' });

    element.style.setProperty('--wzl-accent', '#abcdef');
    api.requestRedraw = vi.fn();
    host.setAttribute('data-wzl-mode', 'light');
    await Promise.resolve();
    expect(api.requestRedraw).toHaveBeenCalled();
    expect(strokeOf(indicatorOf(themed))).toEqual({ kind: 'solid', color: '#abcdef' });
    for (const d of detach) (d as () => void)();
    host.remove();
  });

  it('paints the crosshair in views the pointer is not over, at a fixed screen size', () => {
    let pos: ReturnType<ReturnType<typeof createPointerStore>['get']> = { world: { x: 500, y: 400 }, viewId: null };
    const layer = createLinkedCursorLayer({ id: 'x', pointer: () => pos, color: () => '#f00' });
    expect(layer.draw({ viewId: null }, ROOT, { width: 400, height: 300, dpr: 1 })).toEqual([]);
    const inMini = layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80, dpr: 1 });
    // Four halo bars under four accent bars.
    expect(inMini).toHaveLength(8);
    // A 9px arm at scale 0.08 spans 112.5 world units.
    expect((inMini[4] as { path: { width: number } }).path.width).toBeCloseTo(112.5);
    pos = null;
    expect(layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80, dpr: 1 })).toEqual([]);
  });

  it('keeps the crosshair its screen size on each axis of a stretched or flipped view', () => {
    const pos = { world: { x: 500, y: 400 }, viewId: 'elsewhere' };
    const layer = createLinkedCursorLayer({ id: 'x', pointer: () => pos, color: () => '#f00' });
    // Twice as many px per unit across as down, and y-up.
    const stretched = { x: 0, y: 0, scale: { x: 2, y: -1 } };
    const bars = layer.draw({ viewId: null }, stretched, { width: 400, height: 300, dpr: 1 }).slice(4) as
      Array<{ path: { width: number; height: number } }>;
    // A 9px arm by a 2px bar, in world units on each axis.
    expect(bars[0].path).toMatchObject({ width: 4.5, height: 2 });
    expect(bars[2].path).toMatchObject({ width: 1, height: 9 });
  });

  it('keeps out of views it was not built for', () => {
    const pos = { world: { x: 500, y: 400 }, viewId: 'elsewhere' };
    const layer = createLinkedCursorLayer({ id: 'x', pointer: () => pos, color: () => '#f00', views: [null] });
    expect(layer.draw({ viewId: null }, ROOT, { width: 400, height: 300, dpr: 1 })).toHaveLength(8);
    expect(layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80, dpr: 1 })).toEqual([]);
  });
});

describe('linked cursor', () => {
  function fakeApi() {
    return { element: null, requestRedraw: vi.fn() } as unknown as CanvasExtensionApi & { requestRedraw: ReturnType<typeof vi.fn> };
  }

  it('repaints while the crosshair shows and once as it hides, not for moves it never shows for', () => {
    const store = createPointerStore();
    const api = fakeApi();
    const entry = createLinkedCursorContribution();
    const detach = entry.attach!(api, { get: ((name: string) => (name === 'pointer' ? store : undefined)) as never });
    // Over this surface's own camera: nothing to show here.
    store.set({ world: { x: 1, y: 1 }, viewId: null });
    expect(api.requestRedraw).not.toHaveBeenCalled();
    // Over another surface's view: shows, and follows.
    store.set({ world: { x: 2, y: 2 }, viewId: 'minimap' });
    store.set({ world: { x: 3, y: 3 }, viewId: 'minimap' });
    expect(api.requestRedraw).toHaveBeenCalledTimes(2);
    // Leaves: one more to clear it.
    store.set(null);
    expect(api.requestRedraw).toHaveBeenCalledTimes(3);
    detach();
    store.set({ world: { x: 4, y: 4 }, viewId: 'minimap' });
    expect(api.requestRedraw).toHaveBeenCalledTimes(4); // the detach's own clear, no more
  });
});

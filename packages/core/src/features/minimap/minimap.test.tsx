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
import { useEffect } from 'react';
import { SceneCanvas } from '../../canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { useOptionalViewRegistry, type ViewRegistry } from '../../canvas/viewRegistry';
import type { View } from 'core/viewport/view';
import type { CanvasExtensionApi } from '../../canvas/canvasExtension';
import type { ViewApi } from 'interactions/actions/depSchema';
import { createPointerStore } from 'features/pointer/PointerContext';
import { createMinimapContribution, createLinkedCursorContribution } from './createMinimapContribution';
import { createIndicatorLayer, createLinkedCursorLayer } from './layers';

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

let views: ViewRegistry | null = null;
function Probe() {
  const v = useOptionalViewRegistry();
  useEffect(() => { views = v; });
  return null;
}

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  scene.add({ kind: 'leaf', layer: 'main', pose: { x: 990, y: 790, width: 10, height: 10 }, data: { kind: 'rect' } });
  const onViewChange = vi.fn();
  const minimap = createMinimapContribution({ rect: RECT });
  const r = render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} onViewChange={onViewChange} ambient={[minimap]}>
      <Probe />
    </SceneCanvas>,
  );
  return { scene, onViewChange, canvas: r.container.querySelector('canvas')! };
}

const last = (fn: ReturnType<typeof vi.fn>): View => fn.mock.calls.at(-1)![0] as View;

describe('input in the minimap', () => {
  it('frames the scene through its fit camera', () => {
    mount();
    const mini = views!.list().find((v) => v.id === 'minimap')!;
    const cam = mini.target.deps!().view!.get();
    expect(cam.x).toBeCloseTo(FIT.x);
    expect(cam.y).toBeCloseTo(FIT.y);
    expect(cam.scale.x).toBeCloseTo(FIT.scale.x);
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
    const mini = views!.list().find((v) => v.id === 'minimap')!;
    expect(mini.target.deps!().view!.get().x).toBeCloseTo(FIT.x);
    expect(h.scene.getSelection()).toEqual([]);
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
    expect(layer.draw({ viewId: null }, FIT, { width: 400, height: 300 })).toEqual([]);
    const [cmd] = layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80 });
    expect(cmd).toMatchObject({ kind: 'path', path: { kind: 'rect', x: 100, y: 50, width: 200, height: 150 } });
    // One screen pixel at the minimap's 0.08 scale.
    expect((cmd as { stroke: { width: number } }).stroke.width).toBeCloseTo(12.5);
  });

  it('paints the crosshair in views the pointer is not over, at a fixed screen size', () => {
    let pos: ReturnType<ReturnType<typeof createPointerStore>['get']> = { worldX: 500, worldY: 400, viewId: null };
    const layer = createLinkedCursorLayer({ id: 'x', pointer: () => pos, color: () => '#f00' });
    expect(layer.draw({ viewId: null }, ROOT, { width: 400, height: 300 })).toEqual([]);
    const inMini = layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80 });
    // Four halo bars under four accent bars.
    expect(inMini).toHaveLength(8);
    // A 9px arm at scale 0.08 spans 112.5 world units.
    expect((inMini[4] as { path: { width: number } }).path.width).toBeCloseTo(112.5);
    pos = null;
    expect(layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80 })).toEqual([]);
  });

  it('keeps out of views it was not built for', () => {
    const pos = { worldX: 500, worldY: 400, viewId: 'elsewhere' };
    const layer = createLinkedCursorLayer({ id: 'x', pointer: () => pos, color: () => '#f00', views: [null] });
    expect(layer.draw({ viewId: null }, ROOT, { width: 400, height: 300 })).toHaveLength(8);
    expect(layer.draw({ viewId: 'minimap' }, FIT, { width: 100, height: 80 })).toEqual([]);
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
    store.set({ worldX: 1, worldY: 1, viewId: null });
    expect(api.requestRedraw).not.toHaveBeenCalled();
    // Over another surface's view: shows, and follows.
    store.set({ worldX: 2, worldY: 2, viewId: 'minimap' });
    store.set({ worldX: 3, worldY: 3, viewId: 'minimap' });
    expect(api.requestRedraw).toHaveBeenCalledTimes(2);
    // Leaves: one more to clear it.
    store.set(null);
    expect(api.requestRedraw).toHaveBeenCalledTimes(3);
    detach();
    store.set({ worldX: 4, worldY: 4, viewId: 'minimap' });
    expect(api.requestRedraw).toHaveBeenCalledTimes(4); // the detach's own clear, no more
  });
});

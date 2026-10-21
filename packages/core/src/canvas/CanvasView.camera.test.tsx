/**
 * A `<CanvasView>`'s camera, driven and watched through `cameraRef`: the same
 * contract `<Canvas>` keeps for its own, pinned for the canvas in
 * `Canvas.imperativeView.test.tsx`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, useEffect } from 'react';
import { CanvasView } from './CanvasView';
import type { CameraHeldViewProps, CanvasViewCommonProps } from './canvasViewProps';
import type { CanvasViewCamera } from './canvasExtension';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import type { View } from 'core/viewport/view';
import type { ViewApi } from 'interactions/actions/depSchema';

/** What a test sets on the camera-held view the harness mounts. */
type HarnessProps = Partial<CanvasViewCommonProps> & CameraHeldViewProps;

const PANEL = { x: 100, y: 0, w: 100, h: 100 };
const at = (x: number, y = 0): View => ({ x, y, scale: { x: 1, y: 1 } });

afterEach(() => { vi.restoreAllMocks(); });

/** A surface 300×200 at the client origin, looking through `outer`. */
function Surface({ outer, redraw, onReady }: {
  outer: () => View;
  redraw: () => void;
  onReady: (r: ViewRegistry) => void;
}) {
  const registry = useOptionalViewRegistry()!;
  useEffect(() => {
    onReady(registry);
    return registry.attachSurface({
      view: outer,
      dims: () => ({ width: 300, height: 200 }),
      layers: () => [],
      requestRedraw: redraw,
      hitTestExtras: () => null,
      claimsAbove: () => false,
      clientToWorld: (x, y) => [x, y],
      chromeState: () => ({
        selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      }),
    });
  }, [registry, outer, redraw, onReady]);
  return null;
}

function mount(props: HarnessProps = {}) {
  const camera = createRef<CanvasViewCamera>();
  const redraw = vi.fn();
  let outer = at(0);
  const readOuter = (): View => outer;
  let registry!: ViewRegistry;
  const onReady = (r: ViewRegistry): void => { registry = r; };
  const ui = (p: HarnessProps) => (
    <ViewRegistryProvider>
      <Surface outer={readOuter} redraw={redraw} onReady={onReady} />
      <CanvasView id="panel" bounds={PANEL} cameraRef={camera} {...p} />
    </ViewRegistryProvider>
  );
  const r = render(ui(props));
  return {
    camera: camera.current!,
    redraw,
    setOuter: (v: View) => { outer = v; },
    /** The camera as an action dispatched inside the view sees it. */
    viewDep: (): ViewApi => registry.list()[0]!.target.deps!().view!,
    rerender: (p: HarnessProps) => r.rerender(ui(p)),
    unmount: r.unmount,
  };
}

describe('<CanvasView> camera', () => {
  it('setView takes an updater, built on the camera as it stands', () => {
    const { camera } = mount({ defaultView: at(5) });
    act(() => {
      camera.setView((v) => ({ ...v, x: v.x + 10 }));
      camera.setView((v) => ({ ...v, x: v.x + 1 }));
    });
    expect(camera.getView().x).toBe(16);
  });

  it('tells subscribers of each write, clamped as the camera took it, and repaints the surface', () => {
    const { camera, redraw } = mount({ viewBounds: { x: 0, y: 0, width: 150, height: 100 } });
    const seen: View[] = [];
    const off = camera.subscribeView((v) => seen.push(v));
    redraw.mockClear();

    act(() => { camera.setView(at(400)); });
    expect(seen.map((v) => v.x)).toEqual([50]);
    expect(redraw).toHaveBeenCalledTimes(1);

    off();
    act(() => { camera.setView(at(0)); });
    expect(seen).toHaveLength(1);
  });

  it('tells subscribers of a write an action made inside the view', () => {
    const { camera, viewDep } = mount();
    const seen = vi.fn();
    camera.subscribeView(seen);
    act(() => { viewDep().set(at(7)); });
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ x: 7 }));
  });

  it('refuses setView while controlled, says why once, and forwards the write', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onViewChange = vi.fn();
    const { camera } = mount({ view: at(3), onViewChange });

    act(() => { camera.setView(at(40)); camera.setView(at(41)); });

    expect(camera.getView().x).toBe(3);
    expect(onViewChange.mock.calls.map(([v]) => v.x)).toEqual([40, 41]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('controlled'));
  });

  it('forwards an action\'s write on a controlled view without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onViewChange = vi.fn();
    const { camera, viewDep } = mount({ view: at(3), onViewChange });

    act(() => { viewDep().set(at(40)); });

    expect(camera.getView().x).toBe(3);
    expect(onViewChange).toHaveBeenCalledWith(expect.objectContaining({ x: 40 }));
    expect(warn).not.toHaveBeenCalled();
  });

  it('tells subscribers when the controlled prop changes, and only then', () => {
    const { camera, rerender } = mount({ view: at(3) });
    const seen = vi.fn();
    camera.subscribeView(seen);

    rerender({ view: at(3) });
    expect(seen).not.toHaveBeenCalled();
    rerender({ view: at(9) });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ x: 9 }));
  });

  it('reads a derived camera fresh from the surface it derives from', () => {
    const { camera, setOuter } = mount({ view: (outer) => ({ ...outer, x: outer.x * 2 }) });
    setOuter(at(4));
    expect(camera.getView().x).toBe(8);
  });

  it('drops its subscribers on unmount', () => {
    const onViewChange = vi.fn();
    const { camera, unmount } = mount({ onViewChange });
    const seen = vi.fn();
    camera.subscribeView(seen);
    unmount();
    camera.setView(at(1));
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('<CanvasView> repaint', () => {
  // Its props reach the surface's paint through refs, so no identity the
  // surface compares moves with them.
  it('asks the surface to repaint when only a prop the paint reads changes', () => {
    const { redraw, rerender } = mount({ layerVisibility: {} });
    redraw.mockClear();
    rerender({ layerVisibility: { grid: false } });
    expect(redraw).toHaveBeenCalled();
  });
});

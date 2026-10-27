/**
 * A `<CanvasView>`'s aim: held as a prop in place of a camera, or answered
 * from the camera it holds, and written either way through the registry.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, useEffect } from 'react';
import { CanvasView } from './CanvasView';
import type { AimHeldViewProps, CameraHeldViewProps, CanvasViewCommonProps } from './canvasViewProps';
import type { CanvasViewCamera } from './canvasExtension';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { rectAim } from 'domains/viewports/aim';
import type { View } from 'core/viewport/view';

/** What a test sets on the view the harness mounts: either side, the common props optional. */
type HarnessProps = Partial<CanvasViewCommonProps> & (CameraHeldViewProps | AimHeldViewProps);

const PANEL = { x: 0, y: 0, w: 200, h: 100 };
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
  render(
    <ViewRegistryProvider>
      <Surface outer={readOuter} redraw={redraw} onReady={onReady} />
      <CanvasView id="panel" bounds={PANEL} cameraRef={camera} {...props} />
    </ViewRegistryProvider>,
  );
  return {
    camera,
    registry,
    setOuter: (v: View) => { outer = v; },
  };
}

describe('<CanvasView aim>', () => {
  it('fits its camera to the aim it holds', () => {
    const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 } });
    expect(h.camera.current!.getView()).toEqual({ x: -15, y: 20, scale: { x: 2, y: 2 } });
  });

  it('answers the aim it holds, not the wider rect it shows', () => {
    const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 } });
    expect(h.registry.aimOf('panel')!.extent).toEqual({ x: 10, y: 20, width: 50, height: 50 });
  });

  it('follows a thunked aim measured from the outer camera', () => {
    const h = mount({ aim: (outer) => ({ x: outer.x, y: outer.y, width: 100, height: 50 }) });
    h.setOuter({ x: 40, y: 0, scale: { x: 1, y: 1 } });
    expect(h.camera.current!.getView()).toMatchObject({ x: 40, scale: { x: 2, y: 2 } });
  });

  it('reports a pan as the held rect carried with the camera', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onAimChange = vi.fn();
    const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 }, onAimChange });
    act(() => h.camera.current!.setView({ x: 0, y: 20, scale: { x: 2, y: 2 } }));
    expect(onAimChange).toHaveBeenLastCalledWith({ x: 25, y: 20, width: 50, height: 50 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`onAimChange`'));
  });

  it('reports a zoom as the held rect scaled with the camera, keeping its aspect', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onAimChange = vi.fn();
    const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 }, onAimChange });
    act(() => h.camera.current!.setView({ x: -15, y: 20, scale: { x: 4, y: 4 } }));
    expect(onAimChange).toHaveBeenLastCalledWith({ x: -2.5, y: 20, width: 25, height: 25 });
  });

  it('reports a written aim through onAimChange', () => {
    const onAimChange = vi.fn();
    const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 }, onAimChange });
    expect(h.registry.setAim('panel', rectAim('panel', { x: 1, y: 2, width: 3, height: 4 }))).toBe(true);
    expect(onAimChange).toHaveBeenLastCalledWith({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('refuses an aim it cannot read while holding one', () => {
    const onAimChange = vi.fn();
    const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 }, onAimChange });
    expect(h.registry.setAim('panel', { ...rectAim('panel', { x: 0, y: 0, width: 1, height: 1 }), kind: 'frustum' })).toBe(false);
    expect(onAimChange).not.toHaveBeenCalled();
  });

  it("answers a camera-held view's aim from its camera", () => {
    const h = mount({ defaultView: { x: 5, y: 0, scale: { x: 0.5, y: 0.5 } } });
    expect(h.registry.aimOf('panel')!.extent).toEqual({ x: 5, y: 0, width: 400, height: 200 });
  });

  it('moves a camera-held view to a written aim, keeping its scale', () => {
    const h = mount({ defaultView: { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } } });
    expect(h.registry.setAim('panel', rectAim('panel', { x: 30, y: 40, width: 400, height: 200 }))).toBe(true);
    expect(h.camera.current!.getView()).toEqual({ x: 30, y: 40, scale: { x: 0.5, y: 0.5 } });
  });

  it('refuses an aim on a controlled camera with no onViewChange, as the write goes nowhere', () => {
    const h = mount({ view: at(0) });
    expect(h.registry.setAim('panel', rectAim('panel', { x: 30, y: 40, width: 200, height: 100 }))).toBe(false);
    expect(h.camera.current!.getView()).toEqual(at(0));
  });

  it('takes an aim on a controlled camera that reports to onViewChange', () => {
    const onViewChange = vi.fn();
    const h = mount({ view: at(0), onViewChange });
    expect(h.registry.setAim('panel', rectAim('panel', { x: 30, y: 40, width: 200, height: 100 }))).toBe(true);
    expect(onViewChange).toHaveBeenLastCalledWith(at(30, 40));
  });

  it('refuses an aim it cannot read', () => {
    const h = mount({});
    expect(h.registry.setAim('panel', { ...rectAim('panel', { x: 0, y: 0, width: 1, height: 1 }), kind: 'frustum' })).toBe(false);
  });

  it('takes an aim or a camera, never both', () => {
    const both = (
      // @ts-expect-error `aim` and `view` are either/or.
      <CanvasView id="x" bounds={PANEL} aim={{ x: 0, y: 0, width: 1, height: 1 }} view={at(0)} />
    );
    expect(both).toBeTruthy();
  });
});

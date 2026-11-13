/** Wheel and trackpad pinch over `<MinimapCanvas>` zoom the main view about the point under the cursor. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createScene, RECT_POSE_DESCRIPTOR, wheelZoomFactor, DEFAULT_MAX_ZOOM } from '@weasel-js/core';
import type { DrawCommand, PoseDescriptor, Scene, View, ZoomClampOptions } from '@weasel-js/core';
import { MinimapCanvas } from './MinimapCanvas';
import { computeFitView } from './minimapMath';

vi.mock('@weasel-js/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  WeaselRenderer: class {
    render(): void {}
    lastFrameStats() { return { retained: { composited: 0, declined: 0 } }; }
    resize(): void {}
    dispose(): void {}
  },
}));

beforeEach(() => {
  cleanup();
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? fakeGl : null;
  }) as HTMLCanvasElement['getContext'];
});

type P = { x: number; y: number; width: number; height: number };
const descriptor = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<P>;

function makeScene(): Scene<object, 'main', P> {
  const s = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 200, height: 200 } });
  });
  return s;
}

const drawOne = (): DrawCommand[] => [];
const MAIN: View = { x: 10, y: 20, scale: { x: 2, y: 2 } };
const MAIN_DIMS = { width: 400, height: 300 };

function mount(wheelZoom?: boolean | ZoomClampOptions, mainView: View = MAIN) {
  const scene = makeScene();
  const onChange = vi.fn<(v: View) => void>();
  const { container } = render(
    <MinimapCanvas
      scene={scene}
      mainView={mainView}
      mainViewDims={MAIN_DIMS}
      onMainViewChange={onChange}
      width={100}
      height={100}
      drawOne={drawOne}
      poseDescriptor={descriptor}
      {...(wheelZoom === undefined ? {} : { wheelZoom })}
    />,
  );
  const fit = computeFitView(scene, { width: 100, height: 100 }, 'scene', descriptor);
  return { canvas: container.querySelector('canvas')!, onChange, fit };
}

/** Screen position, in the main view, of world point `w`. */
const onMain = (v: View, w: { x: number; y: number }) => ({ x: (w.x - v.x) * v.scale.x, y: (w.y - v.y) * v.scale.y });

describe('<MinimapCanvas> wheel zoom', () => {
  it('zooms the main view about the world point under the cursor', () => {
    const { canvas, onChange, fit } = mount();
    fireEvent.wheel(canvas, { clientX: 30, clientY: 60, deltaY: -100 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0];
    expect(next.scale.x).toBeCloseTo(MAIN.scale.x * wheelZoomFactor(-100));
    const world = { x: fit.x + 30 / fit.scale.x, y: fit.y + 60 / fit.scale.y };
    const before = onMain(MAIN, world);
    const after = onMain(next, world);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('zooms on a trackpad pinch, which arrives as ctrl+wheel', () => {
    const { canvas, onChange } = mount();
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: 10, ctrlKey: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].scale.x).toBeLessThan(MAIN.scale.x);
  });

  it('zooms on a Safari trackpad pinch, about the point under it', () => {
    const { canvas, onChange, fit } = mount();
    const gesture = (type: string, scale: number): boolean => {
      const ev = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        scale, rotation: 0, clientX: 30, clientY: 60, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      });
      act(() => { canvas.dispatchEvent(ev); });
      return ev.defaultPrevented;
    };
    expect(gesture('gesturestart', 1)).toBe(true);
    gesture('gesturechange', 1.5);
    gesture('gestureend', 1.5);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0];
    expect(next.scale.x).toBeCloseTo(MAIN.scale.x * 1.5);
    const world = { x: fit.x + 30 / fit.scale.x, y: fit.y + 60 / fit.scale.y };
    expect(onMain(next, world).x).toBeCloseTo(onMain(MAIN, world).x);
    expect(onMain(next, world).y).toBeCloseTo(onMain(MAIN, world).y);
  });

  it('clamps to the kit default limits', () => {
    const { canvas, onChange } = mount(undefined, { x: 0, y: 0, scale: { x: DEFAULT_MAX_ZOOM, y: DEFAULT_MAX_ZOOM } });
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: -500 });
    expect(onChange.mock.calls[0]![0].scale.x).toBe(DEFAULT_MAX_ZOOM);
  });

  it('clamps to the limits it is given', () => {
    const { canvas, onChange } = mount({ min: 0.5, max: 2.5 });
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: -5000 });
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: 5000 });
    expect(onChange.mock.calls[0]![0].scale.x).toBe(2.5);
    // The main view stays at MAIN (a controlled prop the test never updates).
    expect(onChange.mock.calls[1]![0].scale.x).toBe(0.5);
  });

  it('leaves the wheel alone when turned off', () => {
    const { canvas, onChange } = mount(false);
    const ev = new WheelEvent('wheel', { clientX: 50, clientY: 50, deltaY: -100, bubbles: true, cancelable: true });
    canvas.dispatchEvent(ev);
    expect(onChange).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});

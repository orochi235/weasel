import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, createEvent, fireEvent, render } from '@testing-library/react';
import { createScene, RECT_POSE_DESCRIPTOR, type PoseDescriptor, type View } from '@weasel-js/core';
import { MinimapCanvas } from './MinimapCanvas';
import { computeFitView } from './minimapMath';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

type P = { x: number; y: number; width: number; height: number };

function makeScene() {
  const s = createScene<null, 'main', P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: null, layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 } });
    s.add({ kind: 'leaf', data: null, layer: 'main', pose: { x: 300, y: 100, width: 100, height: 100 } });
  });
  return s;
}

/** jsdom lays nothing out: the canvas's box and its resize reports are stubbed. */
function stubMeasurement(start: { width: number; height: number }) {
  let box = start;
  const observers: (() => void)[] = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: () => void) {}
    observe() { observers.push(this.cb); }
    unobserve() {}
    disconnect() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, left: 0, top: 0, right: box.width, bottom: box.height, ...box, toJSON() {} }) as DOMRect,
  );
  return (next: { width: number; height: number }) => {
    box = next;
    for (const cb of observers) cb();
  };
}

function pointerDown(canvas: HTMLCanvasElement, x: number, y: number) {
  const ev = createEvent.pointerDown(canvas, { pointerId: 1 });
  Object.defineProperty(ev, 'clientX', { value: x });
  Object.defineProperty(ev, 'clientY', { value: y });
  fireEvent(canvas, ev);
}

/** The main view a press at (`x`, `y`) asks for, through the fit at `size`. */
function recenterAt(scene: ReturnType<typeof makeScene>, size: { width: number; height: number }, x: number, y: number): View {
  const fit = computeFitView(scene, size, 'scene', RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<P>);
  return {
    x: fit.x + x / fit.scale.x - 400 / 2,
    y: fit.y + y / fit.scale.y - 300 / 2,
    scale: { x: 1, y: 1 },
  };
}

describe('<MinimapCanvas> with no width or height', () => {
  it('fits the scene to the box it fills, and refits as that box resizes', async () => {
    const resize = stubMeasurement({ width: 200, height: 100 });
    const scene = makeScene();
    const onChange = vi.fn();
    const sizes: { width: number; height: number }[] = [];
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <MinimapCanvas
          scene={scene}
          mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
          mainViewDims={{ width: 400, height: 300 }}
          onMainViewChange={onChange}
          onResize={(s) => sizes.push(s)}
          drawOne={() => []}
        />,
      ));
    });
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

    pointerDown(canvas, 30, 40);
    const first = onChange.mock.calls.at(-1)![0] as View;
    const want = recenterAt(scene, { width: 200, height: 100 }, 30, 40);
    expect(first.x).toBeCloseTo(want.x, 6);
    expect(first.y).toBeCloseTo(want.y, 6);

    await act(async () => { resize({ width: 50, height: 300 }); });
    pointerDown(canvas, 30, 40);
    const second = onChange.mock.calls.at(-1)![0] as View;
    const wantAfter = recenterAt(scene, { width: 50, height: 300 }, 30, 40);
    expect(second.x).toBeCloseTo(wantAfter.x, 6);
    expect(second.y).toBeCloseTo(wantAfter.y, 6);

    expect(sizes).toEqual([{ width: 200, height: 100 }, { width: 50, height: 300 }]);
  });
});

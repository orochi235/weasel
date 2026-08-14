/**
 * Tests for `<MinimapCanvas>` — step 4 of the detached-minimap spec.
 *
 * Reuses the same `WeaselRenderer` mock pattern as `SceneViewCanvas.test.tsx`
 * so we can assert the DrawCommand list reaching the renderer (in particular,
 * that the indicator command lands as the last child of the wrapping group).
 *
 * Pointer events use the `createEvent.pointerXxx` + `Object.defineProperty`
 * pattern that the existing `Canvas.test.tsx` uses, because jsdom's
 * PointerEvent constructor drops `clientX` / `clientY` from the init dict.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEvent, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { createScene } from 'core/scene/scene';
import type { Node, Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
} from '../renderer/DrawCommand';
import { MinimapCanvas } from './MinimapCanvas';
import { computeFitView } from './minimapMath';

// ---------------------------------------------------------------------------
// Mock WeaselRenderer
// ---------------------------------------------------------------------------

const renderMock = vi.fn<(commands: DrawCommand[]) => void>();
const resizeMock = vi.fn<(dims: { width: number; height: number; dpr: number }) => void>();

vi.mock('../renderer/WeaselRenderer', () => {
  return {
    WeaselRenderer: class {
      constructor(_opts: unknown) {}
      render(commands: DrawCommand[]): void { renderMock(commands); }
      resize(dims: { width: number; height: number; dpr: number }): void { resizeMock(dims); }
    },
  };
});

beforeEach(() => {
  renderMock.mockClear();
  resizeMock.mockClear();
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? fakeGl : null;
  }) as HTMLCanvasElement['getContext'];
  // `getBoundingClientRect` returns zeros in jsdom by default, which is what
  // we want: minimap-px == clientX/clientY.
});

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: { color: '#f00' }, layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 } });
    s.add({ kind: 'leaf', data: { color: '#0f0' }, layer: 'main', pose: { x: 100, y: 100, width: 100, height: 100 } });
  });
  return s;
}

const drawOne = (node: Node<D, L, P>, pose: P, _view: View): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
  fill: { fill: 'solid', color: node.data.color },
}];

const identityPoseBounds = (p: P): Bounds => p;

function pointerEvent(canvas: HTMLElement, kind: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel', opts: { x: number; y: number; pointerId?: number }) {
  const ev = createEvent[kind](canvas, { pointerId: opts.pointerId ?? 1 });
  Object.defineProperty(ev, 'clientX', { value: opts.x });
  Object.defineProperty(ev, 'clientY', { value: opts.y });
  return ev;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<MinimapCanvas>', () => {
  it('renders the indicator as the last child of the dispatched group', () => {
    const scene = makeScene();
    const mainView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    render(
      <MinimapCanvas
        scene={scene}
        mainView={mainView}
        mainViewDims={{ width: 200, height: 200 }}
        onMainViewChange={() => {}}
        width={100}
        height={100}
        drawOne={drawOne}
      />,
    );
    expect(renderMock).toHaveBeenCalled();
    const lastCall = renderMock.mock.calls[renderMock.mock.calls.length - 1][0];
    const root = lastCall[0] as GroupDrawCommand;
    expect(root.kind).toBe('group');
    // One scene-layer group holding 2 leaves, then the indicator appended last.
    expect(root.children.length).toBe(2);
    expect((root.children[0] as GroupDrawCommand).children).toHaveLength(2);
    const last = root.children[root.children.length - 1] as PathDrawCommand;
    expect(last.kind).toBe('path');
    expect(last.path.kind).toBe('rect');
    // Indicator carries a stroke; scene commands here carry a fill.
    expect(last.stroke).toBeDefined();
    expect(last.fill).toBeUndefined();
  });

  it('click at a known minimap-px coord recenters main view on the expected world point', () => {
    const scene = makeScene();
    const mainView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const onChange = vi.fn();
    const { container } = render(
      <MinimapCanvas
        scene={scene}
        mainView={mainView}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={onChange}
        width={100}
        height={100}
        drawOne={drawOne}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

    // Derive the fit view the way the component does, so we can predict the
    // recenter result exactly.
    const fitView = computeFitView(scene, { width: 100, height: 100 }, 'scene', identityPoseBounds);
    const px = 30;
    const py = 40;
    const worldX = fitView.x + px / fitView.scale.x;
    const worldY = fitView.y + py / fitView.scale.y;
    const expected: View = {
      x: worldX - 400 / (2 * mainView.scale.x),
      y: worldY - 300 / (2 * mainView.scale.y),
      scale: { x: 1, y: 1 },
    };

    fireEvent(canvas, pointerEvent(canvas, 'pointerDown', { x: px, y: py }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const got = onChange.mock.calls[0][0] as View;
    expect(got.x).toBeCloseTo(expected.x, 6);
    expect(got.y).toBeCloseTo(expected.y, 6);
    expect(got.scale.x).toBe(1);
    expect(got.scale.y).toBe(1);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointermove during a captured drag fires onMainViewChange repeatedly with updated world points', () => {
    const scene = makeScene();
    const mainView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const onChange = vi.fn();
    const { container } = render(
      <MinimapCanvas
        scene={scene}
        mainView={mainView}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={onChange}
        width={100}
        height={100}
        drawOne={drawOne}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

    fireEvent(canvas, pointerEvent(canvas, 'pointerDown', { x: 10, y: 10 }));
    fireEvent(canvas, pointerEvent(canvas, 'pointerMove', { x: 30, y: 30 }));
    fireEvent(canvas, pointerEvent(canvas, 'pointerMove', { x: 50, y: 50 }));

    expect(onChange).toHaveBeenCalledTimes(3);
    // World points should be monotonically increasing on both axes given
    // monotonic input pixels and a positive fit scale.
    const calls = onChange.mock.calls.map((c) => c[0] as View);
    expect(calls[1].x).toBeGreaterThan(calls[0].x);
    expect(calls[2].x).toBeGreaterThan(calls[1].x);
    expect(calls[1].y).toBeGreaterThan(calls[0].y);
    expect(calls[2].y).toBeGreaterThan(calls[1].y);
  });

  it('pointerup releases capture and ends the drag (no further onMainViewChange on pointermove)', () => {
    const scene = makeScene();
    const onChange = vi.fn();
    const { container } = render(
      <MinimapCanvas
        scene={scene}
        mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={onChange}
        width={100}
        height={100}
        drawOne={drawOne}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

    fireEvent(canvas, pointerEvent(canvas, 'pointerDown', { x: 10, y: 10 }));
    fireEvent(canvas, pointerEvent(canvas, 'pointerMove', { x: 30, y: 30 }));
    expect(onChange).toHaveBeenCalledTimes(2);

    fireEvent(canvas, pointerEvent(canvas, 'pointerUp', { x: 30, y: 30 }));
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);

    onChange.mockClear();
    fireEvent(canvas, pointerEvent(canvas, 'pointerMove', { x: 60, y: 60 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pointercancel releases capture cleanly', () => {
    const scene = makeScene();
    const onChange = vi.fn();
    const { container } = render(
      <MinimapCanvas
        scene={scene}
        mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={onChange}
        width={100}
        height={100}
        drawOne={drawOne}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

    fireEvent(canvas, pointerEvent(canvas, 'pointerDown', { x: 10, y: 10 }));
    fireEvent(canvas, pointerEvent(canvas, 'pointerCancel', { x: 10, y: 10 }));
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);

    onChange.mockClear();
    fireEvent(canvas, pointerEvent(canvas, 'pointerMove', { x: 50, y: 50 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('forwards canvasRef to the underlying <canvas>', () => {
    const scene = makeScene();
    const ref = createRef<HTMLCanvasElement>();
    const { container } = render(
      <MinimapCanvas
        scene={scene}
        mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={() => {}}
        width={100}
        height={100}
        drawOne={drawOne}
        canvasRef={ref}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
    expect(ref.current).toBe(container.querySelector('canvas'));
  });

  it('fit="scene" with a multi-node scene matches computeFitView output', () => {
    const scene = makeScene();
    const mainView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const onChange = vi.fn();
    const { container } = render(
      <MinimapCanvas
        scene={scene}
        mainView={mainView}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={onChange}
        width={100}
        height={100}
        drawOne={drawOne}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

    const fitView = computeFitView(scene, { width: 100, height: 100 }, 'scene', identityPoseBounds);

    // A click at the exact minimap center should recenter mainView on the
    // center of the fit rect (i.e., the scene's union AABB center). Scene
    // union here is (0,0,200,200) so center is (100, 100).
    fireEvent(canvas, pointerEvent(canvas, 'pointerDown', { x: 50, y: 50 }));
    const got = onChange.mock.calls[0][0] as View;
    const expectedWorldX = fitView.x + 50 / fitView.scale.x;
    const expectedWorldY = fitView.y + 50 / fitView.scale.y;
    expect(expectedWorldX).toBeCloseTo(100, 6);
    expect(expectedWorldY).toBeCloseTo(100, 6);
    expect(got.x).toBeCloseTo(expectedWorldX - 200, 6);
    expect(got.y).toBeCloseTo(expectedWorldY - 150, 6);
  });

  it('uses the supplied indicatorStyle on the indicator command', () => {
    const scene = makeScene();
    render(
      <MinimapCanvas
        scene={scene}
        mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        mainViewDims={{ width: 400, height: 300 }}
        onMainViewChange={() => {}}
        width={100}
        height={100}
        drawOne={drawOne}
        indicatorStyle={{ stroke: '#ff00aa', width: 3, dash: [5, 2] }}
      />,
    );
    const lastCall = renderMock.mock.calls[renderMock.mock.calls.length - 1][0];
    const root = lastCall[0] as GroupDrawCommand;
    const indicator = root.children[root.children.length - 1] as PathDrawCommand;
    expect(indicator.stroke?.paint).toEqual({ fill: 'solid', color: '#ff00aa' });
    expect(indicator.stroke?.width).toBe(3);
    expect(indicator.stroke?.dash).toEqual([5, 2]);
  });
});

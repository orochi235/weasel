/**
 * Tests for `<SceneViewCanvas>` — step 2 of the detached-minimap spec.
 *
 * We mock `WeaselRenderer` (same shape as `sceneViewRender.test.ts`) so the
 * component can run in jsdom without a real WebGL2 context. The test seam
 * `__getCachedRendererForTest` lets us assert that `renderSceneToCanvas`
 * dispatched into the renderer on each commit. We also spy on `drawOne`
 * directly to confirm scene + view propagation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { createRef, useRef } from 'react';
import { createScene } from 'core/scene/scene';
import type { Node, Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand, GroupDrawCommand } from '../renderer/DrawCommand';
import { SceneViewCanvas } from './SceneViewCanvas';

// ---------------------------------------------------------------------------
// Mock WeaselRenderer
// ---------------------------------------------------------------------------

const renderMock = vi.fn<(commands: DrawCommand[]) => void>();
const resizeMock = vi.fn<(dims: { width: number; height: number; dpr: number }) => void>();
const ctorSpy = vi.fn<(opts: unknown) => void>();

vi.mock('../renderer/WeaselRenderer', () => {
  return {
    WeaselRenderer: class {
      constructor(opts: unknown) { ctorSpy(opts); }
      render(commands: DrawCommand[]): void { renderMock(commands); }
      resize(dims: { width: number; height: number; dpr: number }): void { resizeMock(dims); }
    },
  };
});

// jsdom's HTMLCanvasElement.getContext returns null by default; the helper
// bails when GL isn't present. Stub it so the renderer pipeline actually fires.
beforeEach(() => {
  renderMock.mockClear();
  resizeMock.mockClear();
  ctorSpy.mockClear();
  // Pin DPR so width/height assertions are deterministic.
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  // Stub WebGL2 on every canvas the JSX creates.
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? fakeGl : null;
  }) as HTMLCanvasElement['getContext'];
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
    s.add({ kind: 'leaf', data: { color: '#f00' }, layer: 'main', pose: { x: 10, y: 20, width: 30, height: 40 } });
    s.add({ kind: 'leaf', data: { color: '#0f0' }, layer: 'main', pose: { x: 50, y: 60, width: 70, height: 80 } });
  });
  return s;
}

const drawOne = (node: Node<D, L, P>, pose: P, _view: View): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
  fill: { fill: 'solid', color: node.data.color },
}];

const identityView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<SceneViewCanvas>', () => {
  it('dispatches the scene + drawOne output to the renderer on mount', () => {
    const scene = makeScene();
    const spy = vi.fn(drawOne);

    render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={spy}
      />,
    );

    expect(spy).toHaveBeenCalledTimes(2);
    expect(renderMock).toHaveBeenCalledTimes(1);
    const root = renderMock.mock.calls[0][0][0] as GroupDrawCommand;
    expect(root.kind).toBe('group');
    expect(root.children).toHaveLength(2);
  });

  it('re-renders when the scene is mutated', () => {
    const scene = makeScene();

    render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
      />,
    );

    const initialCalls = renderMock.mock.calls.length;

    act(() => {
      scene.batch('add-one', () => {
        scene.add({
          kind: 'leaf',
          data: { color: '#00f' },
          layer: 'main',
          pose: { x: 1, y: 1, width: 2, height: 2 },
        });
      });
    });

    expect(renderMock.mock.calls.length).toBeGreaterThan(initialCalls);
    const lastDispatch = renderMock.mock.calls[renderMock.mock.calls.length - 1][0];
    const root = lastDispatch[0] as GroupDrawCommand;
    expect(root.children).toHaveLength(3);
  });

  it('re-renders when the view prop changes', () => {
    const scene = makeScene();
    const { rerender } = render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
      />,
    );

    const before = renderMock.mock.calls.length;
    const nextView: View = { x: 100, y: 50, scale: { x: 2, y: 2 } };

    rerender(
      <SceneViewCanvas
        scene={scene}
        view={nextView}
        width={100}
        height={80}
        drawOne={drawOne}
      />,
    );

    expect(renderMock.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-renders when extraCommands changes', () => {
    const scene = makeScene();
    const extraA: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { fill: 'solid', color: '#aaa' },
    }];
    const extraB: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 5, y: 5, width: 2, height: 2 },
      stroke: { paint: { fill: 'solid', color: '#000' }, width: 1 },
    }];

    const { rerender } = render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
        extraCommands={extraA}
      />,
    );

    const before = renderMock.mock.calls.length;
    const lastBefore = renderMock.mock.calls[before - 1][0][0] as GroupDrawCommand;
    expect(lastBefore.children[lastBefore.children.length - 1]).toBe(extraA[0]);

    rerender(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
        extraCommands={extraB}
      />,
    );

    expect(renderMock.mock.calls.length).toBeGreaterThan(before);
    const lastAfter = renderMock.mock.calls[renderMock.mock.calls.length - 1][0][0] as GroupDrawCommand;
    expect(lastAfter.children[lastAfter.children.length - 1]).toBe(extraB[0]);
  });

  it('sets the drawing-buffer size on the underlying <canvas>', () => {
    const scene = makeScene();
    const ref = createRef<HTMLCanvasElement>();

    render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={123}
        height={77}
        drawOne={drawOne}
        canvasRef={ref}
      />,
    );

    expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
    expect(ref.current!.width).toBe(123);
    expect(ref.current!.height).toBe(77);
  });

  it('forwards canvasRef to the underlying <canvas> (object ref)', () => {
    const scene = makeScene();
    const ref = createRef<HTMLCanvasElement>();

    const { container } = render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
        canvasRef={ref}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(ref.current).toBe(canvas);
  });

  it('forwards canvasRef to the underlying <canvas> (callback ref)', () => {
    const scene = makeScene();
    let captured: HTMLCanvasElement | null = null;

    const { container } = render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
        canvasRef={(el) => { captured = el; }}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(captured).toBe(canvas);
  });

  it('applies the consumer className to the canvas (no inline width/height styles)', () => {
    const scene = makeScene();
    const { container } = render(
      <SceneViewCanvas
        scene={scene}
        view={identityView}
        width={100}
        height={80}
        drawOne={drawOne}
        className="my-thumb"
      />,
    );
    const canvas = container.querySelector('canvas')!;
    expect(canvas.classList.contains('my-thumb')).toBe(true);
    // No inline style at all on the canvas — sizing is via width/height
    // attributes (drawing buffer) and the className (CSS).
    expect(canvas.getAttribute('style')).toBeNull();
  });

  it('coexists with a consumer-attached ref via useRef for pointer listeners', () => {
    // Smoke check: a consumer can route their own ref through canvasRef and
    // still see the same element. Mirrors the typical "attach my own
    // pointer listener" pattern the spec describes.
    const scene = makeScene();
    function Consumer() {
      const myRef = useRef<HTMLCanvasElement | null>(null);
      return (
        <SceneViewCanvas
          scene={scene}
          view={identityView}
          width={50}
          height={50}
          drawOne={drawOne}
          canvasRef={myRef}
        />
      );
    }
    const { container } = render(<Consumer />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});

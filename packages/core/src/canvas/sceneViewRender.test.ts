/**
 * Tests for the `renderSceneToCanvas` helper — step 1 of the detached
 * minimap spec. Covers the pure command-building seam directly and the
 * GL-side caching / resize behavior via a mocked `WeaselRenderer` (the
 * real renderer needs a WebGL2 context jsdom can't provide).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { Scene, Node } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand, GroupDrawCommand } from '../renderer/DrawCommand';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import {
  buildSceneViewCommands,
  renderSceneToCanvas,
  __getCachedRendererForTest,
} from './sceneViewRender';

// ---------------------------------------------------------------------------
// Mock WeaselRenderer
// ---------------------------------------------------------------------------

const renderMock = vi.fn<(commands: DrawCommand[]) => void>();
const resizeMock = vi.fn<(dims: { width: number; height: number; dpr: number }) => void>();
const ctorSpy = vi.fn<(opts: unknown) => void>();

vi.mock('../renderer/WeaselRenderer', () => {
  return {
    WeaselRenderer: class {
      constructor(opts: unknown) {
        ctorSpy(opts);
      }
      render(commands: DrawCommand[]): void {
        renderMock(commands);
      }
      resize(dims: { width: number; height: number; dpr: number }): void {
        resizeMock(dims);
      }
    },
  };
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
    s.add({
      kind: 'leaf',
      data: { color: '#f00' },
      layer: 'main',
      pose: { x: 10, y: 20, width: 30, height: 40 },
    });
    s.add({
      kind: 'leaf',
      data: { color: '#0f0' },
      layer: 'main',
      pose: { x: 50, y: 60, width: 70, height: 80 },
    });
  });
  return s;
}

const drawOne = (node: Node<D, L, P>, pose: P, _view: View): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
  fill: { fill: 'solid', color: node.data.color },
}];

const identityView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * Stub a jsdom HTMLCanvasElement to return a `WebGL2`-shaped context object
 * (the helper bails out when `gl.enable` isn't a function, so we only need
 * to satisfy that probe — the mocked WeaselRenderer doesn't touch GL).
 */
function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  c.getContext = ((kind: string) => (kind === 'webgl2' ? fakeGl : null)) as HTMLCanvasElement['getContext'];
  return c;
}

beforeEach(() => {
  renderMock.mockClear();
  resizeMock.mockClear();
  ctorSpy.mockClear();
});

// ---------------------------------------------------------------------------
// buildSceneViewCommands — pure
// ---------------------------------------------------------------------------

describe('buildSceneViewCommands', () => {
  it('emits one command per scene node, in render order, wrapped in a view-transform group', () => {
    const scene = makeScene();
    const calls: Array<{ id: string; pose: P }> = [];
    const trackedDrawOne = (n: Node<D, L, P>, p: P, v: View): DrawCommand[] => {
      calls.push({ id: n.id, pose: p });
      return drawOne(n, p, v);
    };

    const commands = buildSceneViewCommands(scene, identityView, trackedDrawOne);

    expect(commands).toHaveLength(1);
    const root = commands[0] as GroupDrawCommand;
    expect(root.kind).toBe('group');
    expect(root.transform).toEqual(viewToMat3(identityView));
    expect(root.children).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expect(calls[0].pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(calls[1].pose).toEqual({ x: 50, y: 60, width: 70, height: 80 });
  });

  it('appends extra commands after scene commands inside the view group', () => {
    const scene = makeScene();
    const extra: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 5, height: 5 },
      stroke: { paint: { fill: 'solid', color: '#fff' }, width: 1 },
    }];

    const commands = buildSceneViewCommands(scene, identityView, drawOne, extra);
    const root = commands[0] as GroupDrawCommand;

    expect(root.children).toHaveLength(3);
    // Scene commands first, extra last.
    expect(root.children[2]).toBe(extra[0]);
  });

  it('applies the view via viewToMat3 on the wrapping group', () => {
    const scene = makeScene();
    const view: View = { x: 100, y: 200, scale: { x: 0.5, y: 0.5 } };
    const commands = buildSceneViewCommands(scene, view, drawOne);
    const root = commands[0] as GroupDrawCommand;
    expect(Array.from(root.transform!)).toEqual(Array.from(viewToMat3(view)));
  });

  it('handles an empty scene by emitting a group with no children', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const commands = buildSceneViewCommands(scene, identityView, drawOne);
    const root = commands[0] as GroupDrawCommand;
    expect(root.children).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// renderSceneToCanvas — GL plumbing
// ---------------------------------------------------------------------------

describe('renderSceneToCanvas', () => {
  it('dispatches the built command list to the renderer', () => {
    const scene = makeScene();
    const canvas = makeCanvas();

    renderSceneToCanvas({
      canvas, scene, view: identityView,
      width: 100, height: 80, drawOne, dpr: 1,
    });

    expect(renderMock).toHaveBeenCalledTimes(1);
    const dispatched = renderMock.mock.calls[0][0];
    const expected = buildSceneViewCommands(scene, identityView, drawOne);
    expect(dispatched).toEqual(expected);
  });

  it('reuses the WeaselRenderer cached on the canvas across calls', () => {
    const scene = makeScene();
    const canvas = makeCanvas();

    renderSceneToCanvas({ canvas, scene, view: identityView, width: 100, height: 80, drawOne, dpr: 1 });
    const r1 = __getCachedRendererForTest(canvas);
    renderSceneToCanvas({ canvas, scene, view: identityView, width: 100, height: 80, drawOne, dpr: 1 });
    const r2 = __getCachedRendererForTest(canvas);

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(r1).toBeDefined();
    expect(r1).toBe(r2);
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  it('uses a separate renderer per canvas', () => {
    const scene = makeScene();
    const a = makeCanvas();
    const b = makeCanvas();

    renderSceneToCanvas({ canvas: a, scene, view: identityView, width: 100, height: 80, drawOne, dpr: 1 });
    renderSceneToCanvas({ canvas: b, scene, view: identityView, width: 60, height: 40, drawOne, dpr: 1 });

    expect(ctorSpy).toHaveBeenCalledTimes(2);
    expect(__getCachedRendererForTest(a)).not.toBe(__getCachedRendererForTest(b));
  });

  it('appends extra commands after scene commands in the dispatched group', () => {
    const scene = makeScene();
    const canvas = makeCanvas();
    const extra: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { fill: 'solid', color: '#000' },
    }];

    renderSceneToCanvas({
      canvas, scene, view: identityView, width: 100, height: 80,
      drawOne, extraCommands: extra, dpr: 1,
    });

    const dispatched = renderMock.mock.calls[0][0];
    const root = dispatched[0] as GroupDrawCommand;
    expect(root.children).toHaveLength(3);
    expect(root.children[2]).toBe(extra[0]);
  });

  it('resizes the renderer when canvas dims change between calls', () => {
    const scene = makeScene();
    const canvas = makeCanvas();

    renderSceneToCanvas({ canvas, scene, view: identityView, width: 100, height: 80, drawOne, dpr: 1 });
    expect(resizeMock).not.toHaveBeenCalled();

    renderSceneToCanvas({ canvas, scene, view: identityView, width: 200, height: 150, drawOne, dpr: 2 });

    expect(resizeMock).toHaveBeenCalledTimes(1);
    expect(resizeMock).toHaveBeenCalledWith({ width: 200, height: 150, dpr: 2 });

    // Same dims again → no further resize.
    renderSceneToCanvas({ canvas, scene, view: identityView, width: 200, height: 150, drawOne, dpr: 2 });
    expect(resizeMock).toHaveBeenCalledTimes(1);
  });

  it('passes DPR through to the renderer constructor', () => {
    const scene = makeScene();
    const canvas = makeCanvas();

    renderSceneToCanvas({
      canvas, scene, view: identityView, width: 100, height: 80, drawOne, dpr: 3,
    });

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    const opts = ctorSpy.mock.calls[0][0] as { width: number; height: number; dpr: number };
    expect(opts.width).toBe(100);
    expect(opts.height).toBe(80);
    expect(opts.dpr).toBe(3);
  });

  it('is a silent no-op when the canvas has no WebGL2 context', () => {
    const scene = makeScene();
    const canvas = document.createElement('canvas');
    // No getContext stub → jsdom default returns null, helper should bail.
    canvas.getContext = (() => null) as HTMLCanvasElement['getContext'];

    expect(() => {
      renderSceneToCanvas({
        canvas, scene, view: identityView, width: 100, height: 80, drawOne, dpr: 1,
      });
    }).not.toThrow();

    expect(ctorSpy).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
    expect(__getCachedRendererForTest(canvas)).toBeUndefined();
  });
});

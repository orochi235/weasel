/**
 * Every detached canvas surface frees its renderer's GL objects on unmount.
 * Real `WeaselRenderer` against the recording context: what it created must
 * all be deleted, handle for handle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { makeGLRecorder, type GLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { SceneViewCanvas } from './SceneViewCanvas';
import { DrawCanvas } from './DrawCanvas';
import { Canvas } from './testing/BareCanvas';
import { defaultDrawOne } from './defaultDrawOne';
import { cachedCanvasRenderer, leaseCanvasRenderer } from './canvasRenderer';

let rec: GLRecorder;

beforeEach(() => {
  rec = makeGLRecorder();
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  // The recorder answers `canvas` with a function; a context names its element.
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    if (kind !== 'webgl2') return null;
    return new Proxy(rec.gl, { get: (gl, prop) => (prop === 'canvas' ? this : Reflect.get(gl, prop)) });
  }) as HTMLCanvasElement['getContext'];
});

const lose = (canvas: HTMLCanvasElement): Event => {
  const event = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(event);
  return event;
};
const restore = (canvas: HTMLCanvasElement): void => {
  canvas.dispatchEvent(new Event('webglcontextrestored'));
};
const clears = (): number => rec.calls.filter((c) => c.name === 'clear').length;

type P = { x: number; y: number; width: number; height: number };

function makeScene(): Scene<unknown, 'main', P> {
  const s = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  s.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 10, y: 20, width: 30, height: 40 } });
  return s;
}

const KINDS = ['Program', 'Buffer', 'Texture'] as const;

/** Handles created by `create<Kind>` that no `delete<Kind>` has freed. */
function live(kind: (typeof KINDS)[number]): unknown[] {
  const created = rec.calls.filter((c) => c.name === `create${kind}`).map((c) => c.result);
  const deleted = new Set(rec.calls.filter((c) => c.name === `delete${kind}`).map((c) => c.args[0]));
  return created.filter((h) => !deleted.has(h));
}

function expectFreedOnUnmount(element: ReactElement): void {
  const { unmount } = render(element);
  for (const kind of KINDS) expect(live(kind).length, `created ${kind}s`).toBeGreaterThan(0);
  unmount();
  for (const kind of KINDS) expect(live(kind), `live ${kind}s after unmount`).toEqual([]);
}

describe('detached canvas renderer lifetime', () => {
  it('<SceneViewCanvas> deletes its programs, buffers and textures on unmount', () => {
    expectFreedOnUnmount(
      <SceneViewCanvas
        scene={makeScene()} view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        width={100} height={80} drawOne={defaultDrawOne}
      />,
    );
  });

  it('<DrawCanvas> deletes its programs, buffers and textures on unmount', () => {
    expectFreedOnUnmount(
      <DrawCanvas
        width={40} height={20}
        draw={[{ kind: 'path', path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 }, fill: { paint: { kind: 'solid', color: '#f00' } } }]}
      />,
    );
  });

  it('keeps painting through a StrictMode remount, and still frees everything on unmount', async () => {
    const scene = makeScene();
    const { container, unmount } = render(
      <StrictMode>
        <SceneViewCanvas scene={scene} view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }} width={100} height={80} drawOne={defaultDrawOne} />
      </StrictMode>,
    );
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    await act(frame);
    expect(cachedCanvasRenderer(container.querySelector('canvas')!)).toBeDefined();

    const before = clears();
    act(() => { scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 5, height: 5 } }); });
    await act(frame);
    expect(clears()).toBeGreaterThan(before);

    unmount();
    for (const kind of KINDS) expect(live(kind), `live ${kind}s after unmount`).toEqual([]);
  });
});

describe('leaseCanvasRenderer', () => {
  it('frees the previous canvas\'s renderer when the surface moves to another element', () => {
    const lease = leaseCanvasRenderer();
    const a = document.createElement('canvas');
    const b = document.createElement('canvas');
    const size = { width: 10, height: 10, dpr: 1 };
    lease.paint(a, [], { x: 0, y: 0, scale: { x: 1, y: 1 } }, size);
    lease.paint(b, [], { x: 0, y: 0, scale: { x: 1, y: 1 } }, size);
    expect(cachedCanvasRenderer(a)).toBeUndefined();
    expect(cachedCanvasRenderer(b)).toBeDefined();
    lease.release();
    expect(cachedCanvasRenderer(b)).toBeUndefined();
  });

  const size = { width: 10, height: 10, dpr: 1 };
  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };

  it('asks the browser to restore a lost context from a tile of a shared canvas', () => {
    const lease = leaseCanvasRenderer();
    const canvas = document.createElement('canvas');
    lease.bind(canvas, size, { tile: { x: 0, y: 0 } });
    expect(lose(canvas).defaultPrevented).toBe(true);
    lease.release();
    expect(lose(canvas).defaultPrevented).toBe(false);
  });

  it('paints nothing while the context is lost, and tells subscribers when it is back', () => {
    const lease = leaseCanvasRenderer();
    const canvas = document.createElement('canvas');
    const restored = vi.fn();
    lease.subscribeRestored(restored);
    expect(lease.paint(canvas, [], view, size)).toBe(true);

    lose(canvas);
    const before = clears();
    expect(lease.paint(canvas, [], view, size)).toBe(false);
    expect(clears()).toBe(before);
    expect(restored).not.toHaveBeenCalled();

    restore(canvas);
    expect(restored).toHaveBeenCalledTimes(1);
    expect(lease.paint(canvas, [], view, size)).toBe(true);
    expect(clears()).toBe(before + 1);
    lease.release();
  });
});

describe('a context the renderer refuses', () => {
  it('says why once, and does not build a renderer again on every paint', () => {
    rec = makeGLRecorder({ contextAttributes: { stencil: false } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lease = leaseCanvasRenderer();
    const canvas = document.createElement('canvas');
    const size = { width: 10, height: 10, dpr: 1 };
    expect(lease.bind(canvas, size)).toBeNull();
    expect(lease.bind(canvas, size)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][1])).toContain('no stencil buffer');
    expect(rec.calls.filter((c) => c.name === 'getContextAttributes')).toHaveLength(1);
    warn.mockRestore();
  });
});

describe('a canvas whose lost context comes back', () => {
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  it.each([
    ['<DrawCanvas>', <DrawCanvas key="d" width={40} height={20} draw={[]} />],
    ['<SceneViewCanvas>', (
      <SceneViewCanvas
        key="s" scene={makeScene()} view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        width={100} height={80} drawOne={defaultDrawOne}
      />
    )],
    ['<Canvas>', <Canvas key="c" width={40} height={20} layers={{}} />],
  ])('%s repaints with nothing else asking', async (_name, element) => {
    const { container } = render(element);
    await act(frame);
    const canvas = container.querySelector('canvas')!;
    lose(canvas);
    restore(canvas);
    const before = clears();
    await act(frame);
    expect(clears()).toBe(before + 1);
  });
});

/**
 * Every detached canvas surface frees its renderer's GL objects on unmount.
 * Real `WeaselRenderer` against the recording context: what it created must
 * all be deleted, handle for handle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { makeGLRecorder, type GLRecorder } from '../renderer/test-utils/glRecorder';
import { SceneViewCanvas } from './SceneViewCanvas';
import { MinimapCanvas } from './MinimapCanvas';
import { DrawCanvas } from './DrawCanvas';
import { defaultDrawOne } from './defaultDrawOne';
import { cachedCanvasRenderer, leaseCanvasRenderer } from './canvasRenderer';

let rec: GLRecorder;

beforeEach(() => {
  rec = makeGLRecorder();
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? rec.gl : null;
  }) as HTMLCanvasElement['getContext'];
});

type P = { x: number; y: number; width: number; height: number };

function makeScene(): Scene<unknown, 'main', P> {
  const s = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  s.add({ kind: 'leaf', data: {}, layer: 'main', pose: { x: 10, y: 20, width: 30, height: 40 } });
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

  it('<MinimapCanvas> deletes its programs, buffers and textures on unmount', () => {
    expectFreedOnUnmount(
      <MinimapCanvas
        scene={makeScene()} mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        mainViewDims={{ width: 400, height: 300 }} onMainViewChange={() => {}}
        width={100} height={100} drawOne={defaultDrawOne}
      />,
    );
  });

  it('<DrawCanvas> deletes its programs, buffers and textures on unmount', () => {
    expectFreedOnUnmount(
      <DrawCanvas
        width={40} height={20}
        draw={[{ kind: 'path', path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 }, fill: { fill: 'solid', color: '#f00' } }]}
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
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(cachedCanvasRenderer(container.querySelector('canvas')!)).toBeDefined();
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
});

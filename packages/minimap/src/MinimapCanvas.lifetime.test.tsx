/**
 * `<MinimapCanvas>` frees its renderer's GL objects on unmount. Real
 * `WeaselRenderer` against the recording context: what it created must all be
 * deleted, handle for handle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createScene, defaultDrawOne } from '@weasel-js/core';
import { makeGLRecorder, type GLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { MinimapCanvas } from './MinimapCanvas';

type P = { x: number; y: number; width: number; height: number };

const KINDS = ['Program', 'Buffer', 'Texture'] as const;

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

/** Handles created by `create<Kind>` that no `delete<Kind>` has freed. */
function live(kind: (typeof KINDS)[number]): unknown[] {
  const created = rec.calls.filter((c) => c.name === `create${kind}`).map((c) => c.result);
  const deleted = new Set(rec.calls.filter((c) => c.name === `delete${kind}`).map((c) => c.args[0]));
  return created.filter((h) => !deleted.has(h));
}

describe('<MinimapCanvas> renderer lifetime', () => {
  it('deletes its programs, buffers and textures on unmount', () => {
    const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 10, y: 20, width: 30, height: 40 } });
    const { unmount } = render(
      <MinimapCanvas
        scene={scene} mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        mainViewDims={{ width: 400, height: 300 }} onMainViewChange={() => {}}
        width={100} height={100} drawOne={defaultDrawOne}
      />,
    );
    for (const kind of KINDS) expect(live(kind).length, `created ${kind}s`).toBeGreaterThan(0);
    unmount();
    for (const kind of KINDS) expect(live(kind), `live ${kind}s after unmount`).toEqual([]);
  });
});

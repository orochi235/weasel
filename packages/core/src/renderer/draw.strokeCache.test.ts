/**
 * What the renderer does with a cached stroke ribbon. A ribbon large enough to
 * miss the solid batch takes its own draw, and that draw's VAO is the thing
 * under test: minted every frame for a path that keeps changing, minted once
 * for one that does not.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

const M = 0, L = 1;

/** An open polyline whose ribbon comfortably exceeds the solid batch's
 *  256-vertex ceiling, so it takes its own draw rather than being batched. */
function bigPolyline(): PolygonPath {
  const n = 200;
  const commands = new Uint8Array(n);
  const coords = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    commands[i] = i === 0 ? M : L;
    coords[i * 2] = i * 3;
    coords[i * 2 + 1] = (i % 2) * 20;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const stroked = (path: PolygonPath, width: number): DrawCommand => ({
  kind: 'path',
  path,
  stroke: { width, paint: { color: '#222222' } },
});

describe('renderer — stroke ribbon caching', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const vaosCreated = (): number =>
    recorder.calls.filter((c) => c.name === 'createVertexArray').length;

  it('mints no VAO on a repeat frame of the same path and stroke', () => {
    // Frame 1 misses the strokeMeshCache and takes uploadTransient, which
    // never populates GLMeshCache's persistent WeakMap. Frame 2 is the first
    // *hit*, so it's the frame that promotes the mesh via handleFor — and
    // that promotion itself costs one VAO create, since the transient
    // buffers frame 1 made were already freed. Steady state (zero new VAOs)
    // only holds from frame 3 onward, so that's what this asserts.
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(vaosCreated()).toBe(0);
  });

  it('mints a VAO every frame while the stroke width animates', () => {
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2.5)]);
    const first = vaosCreated();
    recorder.reset();
    r.render([stroked(path, 3)]);
    expect(first).toBeGreaterThan(0);
    expect(vaosCreated()).toBe(first);
  });

  it('mints a VAO every frame while the path itself is rebuilt', () => {
    r.render([stroked(bigPolyline(), 2)]);
    recorder.reset();
    r.render([stroked(bigPolyline(), 2)]);
    const first = vaosCreated();
    recorder.reset();
    r.render([stroked(bigPolyline(), 2)]);
    expect(first).toBeGreaterThan(0);
    expect(vaosCreated()).toBe(first);
  });

  it('still draws the ribbon on the cached frame', () => {
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(recorder.calls.filter((c) => c.name === 'drawElements').length).toBeGreaterThan(0);
  });
});

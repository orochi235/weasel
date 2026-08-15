/**
 * What the renderer does with a cached stroke ribbon. A ribbon large enough to
 * miss the solid batch takes its own draw, and that draw's VAO is the thing
 * under test. A VAO deleted before the frame ends was a transient upload; one
 * that survives the frame is a persistent handle.
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

type Recorder = ReturnType<typeof makeGLRecorder>;

const counts = (rec: Recorder) => ({
  created: rec.calls.filter((c) => c.name === 'createVertexArray').length,
  deleted: rec.calls.filter((c) => c.name === 'deleteVertexArray').length,
});

describe('renderer — stroke ribbon caching', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  it('pays a transient upload on first sight, promotes on the second, reuses on the third', () => {
    const path = bigPolyline();

    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(counts(recorder)).toEqual({ created: 1, deleted: 1 });

    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(counts(recorder)).toEqual({ created: 1, deleted: 0 });

    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(counts(recorder)).toEqual({ created: 0, deleted: 0 });
  });

  it('keeps every frame transient while the stroke width animates', () => {
    const path = bigPolyline();
    for (const width of [2, 2.5, 3]) {
      recorder.reset();
      r.render([stroked(path, width)]);
      expect(counts(recorder)).toEqual({ created: 1, deleted: 1 });
    }
  });

  it('keeps every frame transient while the path itself is rebuilt', () => {
    for (let i = 0; i < 3; i++) {
      recorder.reset();
      r.render([stroked(bigPolyline(), 2)]);
      expect(counts(recorder)).toEqual({ created: 1, deleted: 1 });
    }
  });

  it('each renderer pays its own first sight of a mesh the other already promoted', () => {
    // The ribbon cache is module-global, so renderer B is handed the very Mesh
    // object A promoted. B's GL context has never uploaded it, so B must still
    // take a transient upload and free it at end of frame.
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    r.render([stroked(path, 2)]);

    const recorderB = makeGLRecorder();
    const rB = new WeaselRenderer({ gl: recorderB.gl, width: 800, height: 600, dpr: 1 });
    recorderB.reset();
    rB.render([stroked(path, 2)]);
    expect(counts(recorderB)).toEqual({ created: 1, deleted: 1 });

    recorderB.reset();
    rB.render([stroked(path, 2)]);
    expect(counts(recorderB)).toEqual({ created: 1, deleted: 0 });
  });

  it('still draws the ribbon on the cached frame', () => {
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(recorder.calls.filter((c) => c.name === 'drawElements').length).toBeGreaterThan(0);
  });
});

/**
 * Inner/outer alignment on a polygon path renders by tessellating at twice the
 * width and stencilling half of it away, so the ribbon handed to the stencil
 * pass must be twice as wide *everywhere* — including at each `vertexWidths`
 * entry, not just at the uniform `stroke.width`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, Stroke } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

const M = 0, L = 1;

/** A straight horizontal polyline on y = 0, so a ribbon's vertical extent is
 *  exactly the stroke width it was tessellated at. */
function horizontalLine(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L, L]),
    coords: new Float32Array([0, 0, 100, 0, 200, 0]),
    fillRule: 'nonzero',
  };
}

type Recorder = ReturnType<typeof makeGLRecorder>;

/** The tallest vertical span of any float vertex buffer uploaded this frame. */
function ribbonHeight(rec: Recorder): number {
  let tallest = 0;
  for (const call of rec.calls) {
    if (call.name !== 'bufferData') continue;
    const data = call.args[1];
    if (!(data instanceof Float32Array) || data.length < 4) continue;
    let min = Infinity, max = -Infinity;
    for (let i = 1; i < data.length; i += 2) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    if (max - min > tallest) tallest = max - min;
  }
  return tallest;
}

describe('renderer — inner/outer stroke alignment', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const render = (stroke: Stroke): number => {
    recorder.reset();
    r.render([{ kind: 'path', path: horizontalLine(), stroke } as DrawCommand]);
    return ribbonHeight(recorder);
  };

  const paint = { color: '#222222' };

  it('doubles a uniform width', () => {
    expect(render({ width: 10, align: 'inner', paint })).toBeCloseTo(20, 3);
    expect(render({ width: 10, align: 'outer', paint })).toBeCloseTo(20, 3);
  });

  it('doubles per-vertex widths', () => {
    const vertexWidths = [10, 10, 10];
    expect(render({ width: 10, vertexWidths, align: 'inner', paint })).toBeCloseTo(20, 3);
  });

  it('doubles a taper so the widest vertex still governs', () => {
    const vertexWidths = [2, 8, 16];
    expect(render({ width: 4, vertexWidths, align: 'inner', paint })).toBeCloseTo(32, 3);
  });

  it('falls back to the doubled uniform width for an unusable entry', () => {
    const vertexWidths = [Number.NaN, 6, 6];
    expect(render({ width: 10, vertexWidths, align: 'inner', paint })).toBeCloseTo(20, 3);
  });

  it('still reaches the ribbon cache when widths are doubled', () => {
    // The ribbon cache compares `vertexWidths` by reference, so a doubled copy
    // minted per frame would miss it forever and re-tessellate every frame.
    const path = horizontalLine();
    const stroke: Stroke = { width: 4, vertexWidths: [2, 8, 16], align: 'inner', paint };
    const frame = () => {
      recorder.reset();
      r.render([{ kind: 'path', path, stroke } as DrawCommand]);
      return {
        created: recorder.calls.filter((c) => c.name === 'createVertexArray').length,
        deleted: recorder.calls.filter((c) => c.name === 'deleteVertexArray').length,
      };
    };
    frame();
    frame();
    expect(frame()).toEqual({ created: 0, deleted: 0 });
  });
});

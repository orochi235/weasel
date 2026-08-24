/**
 * A `{ px }` stroke width resolves against the accumulated group transform, so
 * the tessellated ribbon narrows as the scale it is drawn under grows.
 *
 * Every stroke here is `align: 'inner'`, which renders through the stencil
 * pass and so uploads its ribbon unbatched, in local units — a center-aligned
 * one is staged into the solid batch with the group transform already baked
 * in, and its vertices no longer report the width it was tessellated at. The
 * stencil pass tessellates at twice the width, hence the doubled expectations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, Stroke } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { mat3 } from './math/mat3';
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

describe('renderer — screen-pixel stroke widths', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const paint = { color: '#222222' };

  /** Render one stroked line inside a group scaled by `s`. A fresh `Path` per
   *  frame keeps the ribbon cache from answering for a previous scale. */
  const renderAtScale = (stroke: Stroke, s: number): number => {
    recorder.reset();
    r.render([{
      kind: 'group',
      transform: mat3.scale(mat3.identity(), s, s),
      children: [{ kind: 'path', path: horizontalLine(), stroke }],
    } as DrawCommand]);
    return ribbonHeight(recorder);
  };

  it('narrows a { px } ribbon as the accumulated scale grows', () => {
    const stroke: Stroke = { width: { px: 8 }, align: 'inner', paint };
    expect(renderAtScale(stroke, 1)).toBeCloseTo(16, 3);
    expect(renderAtScale(stroke, 4)).toBeCloseTo(4, 3);
  });

  it('leaves a world-unit ribbon the same width at every scale', () => {
    const stroke: Stroke = { width: 8, align: 'inner', paint };
    expect(renderAtScale(stroke, 1)).toBeCloseTo(16, 3);
    expect(renderAtScale(stroke, 4)).toBeCloseTo(16, 3);
  });

  it('resolves against the product of nested group transforms', () => {
    recorder.reset();
    r.render([{
      kind: 'group',
      transform: mat3.scale(mat3.identity(), 2, 2),
      children: [{
        kind: 'group',
        transform: mat3.scale(mat3.identity(), 3, 3),
        children: [{ kind: 'path', path: horizontalLine(), stroke: { width: { px: 12 }, align: 'inner', paint } }],
      }],
    } as DrawCommand]);
    expect(ribbonHeight(recorder)).toBeCloseTo(4, 3);
  });

  it('re-tessellates rather than serving the ribbon cached at another scale', () => {
    const path = horizontalLine();
    const stroke: Stroke = { width: { px: 8 }, align: 'inner', paint };
    const frame = (s: number): number => {
      recorder.reset();
      r.render([{
        kind: 'group',
        transform: mat3.scale(mat3.identity(), s, s),
        children: [{ kind: 'path', path, stroke }],
      } as DrawCommand]);
      return ribbonHeight(recorder);
    };
    expect(frame(1)).toBeCloseTo(16, 3);
    expect(frame(4)).toBeCloseTo(4, 3);
    expect(frame(1)).toBeCloseTo(16, 3);
  });
});

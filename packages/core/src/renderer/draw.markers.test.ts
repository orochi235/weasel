/**
 * A stroke's markers are drawn by the renderer, sized against the scale the
 * stroke is drawn under — so a `{ px }` head holds its screen size through a
 * zoom, and the ribbon stops short of it by the same resolved size.
 *
 * Both ribbon and head join the solid batch, whose vertices carry the group
 * transform baked in: extents read off them are screen pixels. The head is a
 * test marker painted its own color, so its vertices can be told apart.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PolygonPath, Stroke } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { mat3 } from './math/mat3';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';
import { registerMarker } from '../core/strokeMarkers';

const M = 0, L = 1;

function horizontalLine(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L]),
    coords: new Float32Array([0, 50, 200, 50]),
    fillRule: 'nonzero',
  };
}

/** The built-in arrow's shape and inset, filled green. */
const HEAD = 'test-green-arrow';
const LINE_PAINT = { color: '#ff0000' };

type Recorder = ReturnType<typeof makeGLRecorder>;

interface Extent { minX: number; maxX: number; height: number }

/** Screen extents of the batched vertices, split by whether they are green. */
function extents(rec: Recorder): { head: Extent; ribbon: Extent } {
  const boxes = { head: [Infinity, -Infinity, Infinity, -Infinity], ribbon: [Infinity, -Infinity, Infinity, -Infinity] };
  for (const call of rec.calls) {
    if (call.name !== 'bufferSubData') continue;
    const data = call.args[2];
    const count = call.args[4];
    if (!(data instanceof Float32Array) || typeof count !== 'number') continue;
    for (let i = 0; i + FLOATS_PER_VERTEX <= count; i += FLOATS_PER_VERTEX) {
      const b = data[i + 3] > 0.5 ? boxes.head : boxes.ribbon;
      b[0] = Math.min(b[0], data[i]); b[1] = Math.max(b[1], data[i]);
      b[2] = Math.min(b[2], data[i + 1]); b[3] = Math.max(b[3], data[i + 1]);
    }
  }
  const ext = (b: number[]): Extent => ({ minX: b[0], maxX: b[1], height: b[3] - b[2] });
  return { head: ext(boxes.head), ribbon: ext(boxes.ribbon) };
}

describe('renderer — stroke markers', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;
  let dispose: () => void;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    dispose = registerMarker({
      id: HEAD,
      inset: 3,
      fill: { color: '#00ff00' },
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([M, L, L, 4]),
        coords: new Float32Array([0, 0, -3 * size, -1.5 * size, -3 * size, 1.5 * size]),
        fillRule: 'nonzero',
      }),
    });
  });
  afterEach(() => dispose());

  const frame = (stroke: Stroke, s: number) => {
    recorder.reset();
    r.render([{
      kind: 'group',
      transform: mat3.scaled(mat3.identity(), s, s),
      children: [{ kind: 'path', path: horizontalLine(), stroke }],
    } as DrawCommand]);
    return extents(recorder);
  };

  it('draws the head of a stroke that carries one', () => {
    const { head } = frame({ width: 0.5, paint: LINE_PAINT, markerEnd: { key: HEAD, size: 4 } }, 1);
    expect(head.height).toBeCloseTo(12, 3);
    expect(head.maxX).toBeCloseTo(200, 3);
  });

  it('holds a { px } head at its screen size through a zoom', () => {
    const stroke: Stroke = { width: 0.5, paint: LINE_PAINT, markerEnd: { key: HEAD, size: { px: 8 } } };
    expect(frame(stroke, 1).head.height).toBeCloseTo(24, 3);
    expect(frame(stroke, 4).head.height).toBeCloseTo(24, 3);
  });

  it('stops the ribbon short of a { px } head by its resolved size', () => {
    const stroke: Stroke = { width: 0.5, paint: LINE_PAINT, markerEnd: { key: HEAD, size: { px: 8 } } };
    expect(frame(stroke, 1).ribbon.maxX).toBeCloseTo(200 - 24, 3);
    expect(frame(stroke, 4).ribbon.maxX).toBeCloseTo(800 - 24, 3);
  });

  it('sizes a default head from a { px } stroke width resolved at that scale', () => {
    const stroke: Stroke = { width: { px: 2 }, paint: LINE_PAINT, markerEnd: HEAD };
    expect(frame(stroke, 1).head.height).toBeCloseTo(6, 3);
    expect(frame(stroke, 4).head.height).toBeCloseTo(6, 3);
  });
});

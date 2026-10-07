/**
 * A `{ px }` stroke under a non-uniform transform is that many pixels wide on
 * screen in every direction — not the width resolved through the mean scale,
 * which at 4:1 paints a 1px line 0.5px tall running across and 2px wide
 * running down.
 *
 * Center-aligned ribbons join the solid batch, whose vertices carry the group
 * transform baked in, so what is read off them is screen pixels.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Path, Stroke } from '@weasel-js/core';
import { linePath } from '@weasel-js/geom';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { mat3, type GlMat3 } from './math/mat3';
import { FLOATS_PER_VERTEX } from './drawBatch';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';
import { _resetMarkerCommandCacheForTests } from './cache/markerCommandCache';
import { registerMarker } from '../core/strokeMarkers';

type Recorder = ReturnType<typeof makeGLRecorder>;
type Point = [number, number];

const FOUR_TO_ONE = mat3.scaled(mat3.identity(), 4, 1);
const LINE = { color: '#ff0000' };
const HEAD_FILL = '#00ff00';

/** Batched vertices on screen, split by whether they are the green head. */
function batched(rec: Recorder): { ribbon: Point[]; head: Point[] } {
  const out = { ribbon: [] as Point[], head: [] as Point[] };
  for (const call of rec.calls) {
    if (call.name !== 'bufferSubData') continue;
    const data = call.args[2];
    const count = call.args[4];
    if (!(data instanceof Float32Array) || typeof count !== 'number') continue;
    for (let i = 0; i + FLOATS_PER_VERTEX <= count; i += FLOATS_PER_VERTEX) {
      (data[i + 3] > 0.5 ? out.head : out.ribbon).push([data[i], data[i + 1]]);
    }
  }
  return out;
}

const span = (pts: Point[], axis: 0 | 1) =>
  Math.max(...pts.map((p) => p[axis])) - Math.min(...pts.map((p) => p[axis]));

function distanceToSegment([x, y]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

const drawCalls = (rec: Recorder) => rec.calls.filter((c) => c.name === 'drawElements').length;

describe('renderer — { px } strokes under a non-uniform transform', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;
  let dispose: () => void;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    _resetMarkerCommandCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    dispose = registerMarker({
      id: 'test-green-arrow',
      inset: 3,
      fill: { color: HEAD_FILL },
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1, 4]),
        coords: new Float32Array([0, 0, -3 * size, -1.5 * size, -3 * size, 1.5 * size]),
        fillRule: 'nonzero',
      }),
    });
  });
  afterEach(() => dispose());

  const frame = (children: { path: Path; stroke: Stroke }[], transform: GlMat3 = FOUR_TO_ONE) => {
    recorder.reset();
    r.render([{
      kind: 'group',
      transform,
      children: children.map((c) => ({ kind: 'path', ...c })),
    } as DrawCommand]);
    return batched(recorder);
  };

  const onePx: Stroke = { width: { px: 1 }, paint: LINE };

  it('paints a horizontal line one pixel tall', () => {
    const { ribbon } = frame([{ path: linePath({ x: 0, y: 50 }, { x: 100, y: 50 }), stroke: onePx }]);
    expect(span(ribbon, 1)).toBeCloseTo(1, 4);
  });

  it('paints a vertical line one pixel wide', () => {
    const { ribbon } = frame([{ path: linePath({ x: 50, y: 0 }, { x: 50, y: 100 }), stroke: onePx }]);
    expect(span(ribbon, 0)).toBeCloseTo(1, 4);
  });

  it('paints a diagonal line half a pixel either side of it', () => {
    const { ribbon } = frame([{ path: linePath({ x: 0, y: 0 }, { x: 30, y: 40 }), stroke: onePx }]);
    expect(ribbon.length).toBeGreaterThan(0);
    for (const p of ribbon) expect(distanceToSegment(p, [0, 0], [120, 40])).toBeCloseTo(0.5, 4);
  });

  it('outlines a rect one pixel thick on both axes, and aligns it inside', () => {
    const rect: Path = { kind: 'rect', x: 10, y: 10, width: 20, height: 40 };
    const { ribbon } = frame([{ path: rect, stroke: { ...onePx, align: 'inner' } }]);
    const set = (axis: 0 | 1) =>
      [...new Set(ribbon.map((p) => Math.round(p[axis] * 1e4) / 1e4))].sort((m, n) => m - n);
    // Outer edge on the rect, inner edge a pixel in, the ribbon's middle between.
    expect(set(0)).toEqual([40, 40.5, 41, 119, 119.5, 120]);
    expect(set(1)).toEqual([10, 10.5, 11, 49, 49.5, 50]);
  });

  // A dash belongs to the stroke's units: on a `{ px }` stroke it is screen
  // pixels, the way SVG's `non-scaling-stroke` (which a `{ px }` width
  // serializes to) measures it.
  it.each([
    ['horizontal', { x: 0, y: 50 }, { x: 100, y: 50 }, 0],
    ['vertical', { x: 50, y: 0 }, { x: 50, y: 100 }, 1],
  ] as const)('dashes a %s line in screen pixels', (_label, a, b, axis) => {
    const { ribbon } = frame([{ path: linePath(a, b), stroke: { ...onePx, dash: [6, 4] } }]);
    // Four vertices per butt-capped dash; the first dash is the first four.
    expect(span(ribbon.slice(0, 4), axis)).toBeCloseTo(6, 4);
    expect(span(ribbon.slice(0, 4), axis === 0 ? 1 : 0)).toBeCloseTo(1, 4);
  });

  it('sizes and places a default head in screen pixels along a line running across', () => {
    const { ribbon, head } = frame([{
      path: linePath({ x: 0, y: 50 }, { x: 100, y: 50 }),
      stroke: { width: { px: 2 }, paint: LINE, markerEnd: 'test-green-arrow' },
    }]);
    // A 2px stroke makes a 2px marker unit: 6px long, 6px tall.
    expect(span(head, 0)).toBeCloseTo(6, 4);
    expect(span(head, 1)).toBeCloseTo(6, 4);
    expect(Math.max(...head.map((p) => p[0]))).toBeCloseTo(400, 4);
    // The inset is 3 units: the ribbon stops 6px short of the tip.
    expect(Math.max(...ribbon.map((p) => p[0]))).toBeCloseTo(394, 4);
  });

  it('gives a head\'s outline the same screen width on both axes', () => {
    const off = registerMarker({
      id: 'test-green-outline',
      inset: 0,
      fill: 'none',
      outline: { width: 0.5, paint: { color: HEAD_FILL } },
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1, 4]),
        coords: new Float32Array([0, 0, -3 * size, -1.5 * size, -3 * size, 1.5 * size]),
        fillRule: 'nonzero',
      }),
    });
    const { head } = frame([{
      path: linePath({ x: 0, y: 50 }, { x: 100, y: 50 }),
      stroke: { width: { px: 2 }, paint: LINE, markerEnd: 'test-green-outline' },
    }]);
    off();
    // A 6px triangle outlined half a 2px unit wide: half a pixel past each side.
    expect(span(head, 0)).toBeCloseTo(7, 1);
    expect(span(head, 1)).toBeCloseTo(7, 1);
  });

  // A `{ px }` head is screen-sized whatever the line's width is in, so on a
  // world-width line it is built in the stretch too.
  it.each([
    ['across', linePath({ x: 0, y: 50 }, { x: 100, y: 50 }), 0, 400],
    ['down', linePath({ x: 50, y: 0 }, { x: 50, y: 100 }), 1, 100],
  ] as const)('sizes a { px } head in screen pixels on a world-width line running %s', (_label, path, axis, tip) => {
    const { ribbon, head } = frame([{
      path,
      stroke: { width: 0.5, paint: LINE, markerEnd: { key: 'test-green-arrow', size: { px: 2 } } },
    }]);
    expect(span(head, 0)).toBeCloseTo(6, 4);
    expect(span(head, 1)).toBeCloseTo(6, 4);
    expect(Math.max(...head.map((p) => p[axis]))).toBeCloseTo(tip, 4);
    expect(Math.max(...ribbon.map((p) => p[axis]))).toBeCloseTo(tip - 6, 4);
  });

  // A world-sized head is world geometry whatever the line's width is in: the
  // 4:1 view stretches it like any other.
  it('builds a world-sized head in world on a { px } line', () => {
    const { ribbon, head } = frame([{
      path: linePath({ x: 0, y: 50 }, { x: 100, y: 50 }),
      stroke: { width: { px: 2 }, paint: LINE, markerEnd: { key: 'test-green-arrow', size: 2 } },
    }]);
    // 6 world units long, 6 tall: 24px across, 6px down.
    expect(span(head, 0)).toBeCloseTo(24, 4);
    expect(span(head, 1)).toBeCloseTo(6, 4);
    expect(Math.max(...head.map((p) => p[0]))).toBeCloseTo(400, 4);
    // The inset is 3 units of 2 world: the ribbon stops 6 world, 24px, short.
    expect(Math.max(...ribbon.map((p) => p[0]))).toBeCloseTo(376, 4);
    expect(span(ribbon, 1)).toBeCloseTo(2, 4);
  });

  it.each([
    ['across', linePath({ x: 0, y: 50 }, { x: 100, y: 50 }), 1, 2],
    ['down', linePath({ x: 50, y: 0 }, { x: 50, y: 100 }), 0, 8],
  ] as const)('keeps vertexWidths world widths on a { px } line running %s', (_label, path, axis, px) => {
    const { ribbon } = frame([{ path, stroke: { ...onePx, vertexWidths: [2, 2] } }]);
    expect(span(ribbon, axis)).toBeCloseTo(px, 4);
  });

  it('gives a { px } head\'s outline the same screen width on both axes of a world-width line', () => {
    const off = registerMarker({
      id: 'test-green-outline-px',
      inset: 0,
      fill: 'none',
      outline: { width: 0.5, paint: { color: HEAD_FILL } },
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1, 4]),
        coords: new Float32Array([0, 0, -3 * size, -1.5 * size, -3 * size, 1.5 * size]),
        fillRule: 'nonzero',
      }),
    });
    const { head } = frame([{
      path: linePath({ x: 0, y: 50 }, { x: 100, y: 50 }),
      stroke: { width: 0.5, paint: LINE, markerEnd: { key: 'test-green-outline-px', size: { px: 2 } } },
    }]);
    off();
    expect(span(head, 0)).toBeCloseTo(7, 1);
    expect(span(head, 1)).toBeCloseTo(7, 1);
  });

  it('stays in one batched draw', () => {
    frame([
      { path: linePath({ x: 0, y: 50 }, { x: 100, y: 50 }), stroke: onePx },
      { path: linePath({ x: 50, y: 0 }, { x: 50, y: 100 }), stroke: { ...onePx, dash: [6, 4] } },
      { path: { kind: 'rect', x: 10, y: 10, width: 20, height: 40 }, stroke: onePx },
      { path: linePath({ x: 0, y: 60 }, { x: 100, y: 60 }), stroke: { ...onePx, vertexWidths: [1, 3] } },
      {
        path: linePath({ x: 0, y: 70 }, { x: 100, y: 70 }),
        stroke: { width: 0.5, paint: LINE, markerEnd: { key: 'test-green-arrow', size: { px: 2 } } },
      },
      {
        path: linePath({ x: 0, y: 80 }, { x: 100, y: 80 }),
        stroke: { ...onePx, markerStart: { key: 'test-green-arrow', size: 2 }, markerEnd: 'test-green-arrow' },
      },
    ]);
    expect(drawCalls(recorder)).toBe(1);
  });

  it('aligns a rect through the stencil when the transform turns it', () => {
    const c = Math.cos(0.5), s = Math.sin(0.5);
    const turned = mat3.multiply(mat3.scaled(mat3.identity(), 4, 1), mat3.fromAffine([c, s, -s, c, 0, 0]));
    const rect: Path = { kind: 'rect', x: 10, y: 10, width: 20, height: 40 };
    recorder.reset();
    r.render([{ kind: 'group', transform: turned, children: [{ kind: 'path', path: rect, stroke: { ...onePx, align: 'inner' } }] } as DrawCommand]);
    const replace = recorder.calls.filter((c) => c.name === 'stencilOp' && c.args[2] === recorder.gl.REPLACE);
    expect(replace.length).toBe(1);
  });
});

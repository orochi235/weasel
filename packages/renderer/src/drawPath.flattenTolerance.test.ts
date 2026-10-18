import { describe, it, expect } from 'vitest';
import { PATH_M as M, PATH_Z as Z, PATH_C as C } from '@weasel-js/geom';
import type { GlMat3, PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import type { FlattenTolerance } from './draw/flattenTolerance';
import { meshBatching } from './draw';

// Curved polygon (bezier segments) so the solid-rect fast path can't
// intercept and the tolerance reaches the tessellator.
const POLYGON_CURVED: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, C, C, Z]),
  coords: new Float32Array([
    0, 0,
    40, -40, 80, -40, 100, 0,
    80, 100, 20, 100, 0, 0,
  ]),
  fillRule: 'nonzero',
};

const FILL: DrawCommand = { kind: 'path', path: POLYGON_CURVED, fill: { paint: { kind: 'solid', color: '#000' } } };
const zoom = (s: number): GlMat3 => new Float64Array([s, 0, 0, 0, s, 0, 0, 0, 1]);

describe('flattenTolerance option', () => {
  /** Per-vertex colors take their own draw, so the mesh reaches GL as a buffer
   *  rather than as staged vertices — which is where the pool choice is
   *  observable. A gradient would not: every kind of one batches. */
  const UNBATCHABLE = {
    fill: { paint: { kind: 'solid' as const, color: '#ffffff' } },
    vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
  };

  /** Vertex floats in the staged run: more segments, longer run. */
  const stagedVertexFloats = (
    command: DrawCommand,
    flattenTolerance?: FlattenTolerance,
    dpr = 1,
  ): number => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr, flattenTolerance });
    const caps = { ...meshBatching };
    meshBatching.maxVertices = Infinity;
    try {
      r.render([command]);
    } finally {
      Object.assign(meshBatching, caps);
    }
    return rec.calls.find((c) => c.name === 'bufferSubData' && c.args[0] === rec.gl.ARRAY_BUFFER)!
      .args[4] as number;
  };
  const zoomed = (s: number): DrawCommand => ({ kind: 'group', transform: zoom(s), children: [FILL] });

  it('tessellates finer at a finer world tolerance', () => {
    expect(stagedVertexFloats(FILL, 0.01)).toBeGreaterThan(stagedVertexFloats(FILL));
  });

  it('follows the zoom by default, keeping the chord error on screen', () => {
    expect(stagedVertexFloats(zoomed(8))).toBeGreaterThan(stagedVertexFloats(zoomed(1)));
    expect(stagedVertexFloats(zoomed(1))).toBe(stagedVertexFloats(FILL));
  });

  it('measures a pixel tolerance in device pixels', () => {
    expect(stagedVertexFloats(FILL, undefined, 4)).toBeGreaterThan(stagedVertexFloats(FILL));
    expect(stagedVertexFloats(FILL, undefined, 4)).toBe(stagedVertexFloats(zoomed(4)));
  });

  it('holds a world tolerance against the zoom', () => {
    expect(stagedVertexFloats(zoomed(8), 0.5)).toBe(stagedVertexFloats(FILL, 0.5));
  });

  it('keeps a mesh built at a set tolerance for the next frame', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1, flattenTolerance: 0.01 });
    const cmd = { kind: 'path', path: POLYGON_CURVED, ...UNBATCHABLE } as DrawCommand;
    r.render([cmd]);
    r.render([cmd]);
    // A transient upload is freed at the end of render(); a cached one is not.
    expect(rec.calls.map((c) => c.name)).not.toContain('deleteVertexArray');
    expect(rec.calls.filter((c) => c.name === 'createVertexArray')).toHaveLength(1);
  });

  it('setFlattenTolerance changes the tolerance after construction', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    r.setFlattenTolerance(0.01);
    const caps = { ...meshBatching };
    meshBatching.maxVertices = Infinity;
    try {
      r.render([FILL]);
    } finally {
      Object.assign(meshBatching, caps);
    }
    const floats = rec.calls.find((c) => c.name === 'bufferSubData' && c.args[0] === rec.gl.ARRAY_BUFFER)!
      .args[4] as number;
    expect(floats).toBe(stagedVertexFloats(FILL, 0.01));
  });
});

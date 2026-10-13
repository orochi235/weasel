import { describe, it, expect } from 'vitest';
import { PATH_M as M, PATH_Z as Z, PATH_C as C } from '@weasel-js/geom';
import type { PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { meshBatching } from './draw';

// Curved polygon (bezier segments) so the solid-rect fast path can't
// intercept — needed to prove getMesh vs. fresh tessellate() is actually
// exercised by flattenTolerance.
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

describe('flattenTolerance option', () => {
  /** Per-vertex colors take their own draw, so the mesh reaches GL as a buffer
   *  rather than as staged vertices — which is where the pool choice is
   *  observable. A gradient would not: every kind of one batches. */
  const UNBATCHABLE = {
    fill: { paint: { kind: 'solid' as const, color: '#ffffff' } },
    vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1],
  };

  const stagedVertexFloats = (rec: ReturnType<typeof makeGLRecorder>): number =>
    rec.calls.find((c) => c.name === 'bufferSubData' && c.args[0] === rec.gl.ARRAY_BUFFER)!
      .args[4] as number;

  it('tessellates fresh when flattenTolerance is set', () => {
    const render = (flattenTolerance?: number): ReturnType<typeof makeGLRecorder> => {
      const rec = makeGLRecorder();
      const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1, flattenTolerance });
      // Counted off the staged run, so the finer mesh has to join one.
      const caps = { ...meshBatching };
      meshBatching.maxVertices = Infinity;
      try {
        r.render([{ kind: 'path', path: POLYGON_CURVED, fill: { paint: { kind: 'solid', color: '#000' } } }]);
      } finally {
        Object.assign(meshBatching, caps);
      }
      return rec;
    };
    // A finer tolerance means more segments, so the staged run is longer. The
    // persistent cache's key excludes tolerance, so serving from it would give
    // both renders the same count.
    expect(stagedVertexFloats(render(0.01)))
      .toBeGreaterThan(stagedVertexFloats(render()));
  });

  it('routes a mesh that takes its own draw through the transient pool', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1, flattenTolerance: 0.01 });
    r.render([{ kind: 'path', path: POLYGON_CURVED, ...UNBATCHABLE } as DrawCommand]);
    // Transient meshes are freed at end of render(): deleteVertexArray proves
    // the fill did NOT come from the persistent cache.
    expect(rec.calls.map((c) => c.name)).toContain('deleteVertexArray');
  });

  it('setFlattenTolerance changes the route after construction', () => {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    r.render([{ kind: 'path', path: POLYGON_CURVED, ...UNBATCHABLE } as DrawCommand]);
    expect(rec.calls.map((c) => c.name)).not.toContain('deleteVertexArray');

    const after = makeGLRecorder();
    const r2 = new WeaselRenderer({ gl: after.gl, width: 100, height: 100, dpr: 1 });
    r2.setFlattenTolerance(0.01);
    r2.render([{ kind: 'path', path: POLYGON_CURVED, ...UNBATCHABLE } as DrawCommand]);
    expect(after.calls.map((c) => c.name)).toContain('deleteVertexArray');
  });
});

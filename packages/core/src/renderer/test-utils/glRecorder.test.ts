/**
 * The recorder's Proxy answers `0` for any ALL-CAPS property it does not know
 * and a recording *function* for any lowercase one. Both failure modes are
 * silent, and both produce tests that pass against broken code — an
 * `enable(SCISSOR_TEST)` assertion compares 0 to 0, and `drawingBufferHeight`
 * arithmetic yields NaN. These pin the three the target-rect work depends on.
 */
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './glRecorder';

describe('makeGLRecorder', () => {
  it('gives SCISSOR_TEST a value distinct from the other capability flags', () => {
    const { gl } = makeGLRecorder();
    expect(gl.SCISSOR_TEST).toBe(0x0C11);
    for (const other of [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE, gl.STENCIL_TEST]) {
      expect(gl.SCISSOR_TEST).not.toBe(other);
    }
  });

  it('reports drawing-buffer dimensions as numbers, not recording functions', () => {
    const { gl } = makeGLRecorder({ drawingBufferWidth: 1640, drawingBufferHeight: 800 });
    expect(gl.drawingBufferWidth).toBe(1640);
    expect(gl.drawingBufferHeight).toBe(800);
    expect(gl.drawingBufferHeight - 100).toBe(700);
  });

  it('defaults the drawing buffer to a non-zero size', () => {
    const { gl } = makeGLRecorder();
    expect(typeof gl.drawingBufferWidth).toBe('number');
    expect(gl.drawingBufferWidth).toBeGreaterThan(0);
  });

  it('reports context attributes, defaulting to a stencil buffer', () => {
    expect(makeGLRecorder().gl.getContextAttributes()).toMatchObject({ stencil: true });
    const noStencil = makeGLRecorder({ contextAttributes: { stencil: false } });
    expect(noStencil.gl.getContextAttributes()).toMatchObject({ stencil: false });
  });
});

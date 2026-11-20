/**
 * The recorder's Proxy answers `0` for any ALL-CAPS property it does not know
 * and a recording *function* for any lowercase one. Both failure modes are
 * silent, and both produce tests that pass against broken code — an
 * `enable(SCISSOR_TEST)` assertion compares 0 to 0, and `drawingBufferHeight`
 * arithmetic yields NaN. These pin the three the target-rect work depends on.
 */
import { describe, it, expect } from 'vitest';
import { createGLRecorder } from './glRecorder';

describe('createGLRecorder', () => {
  it('gives every framebuffer constant a real, distinct value', () => {
    const { gl } = createGLRecorder();
    const names = [
      'FRAMEBUFFER', 'RENDERBUFFER', 'COLOR_ATTACHMENT0',
      'DEPTH_STENCIL_ATTACHMENT', 'DEPTH24_STENCIL8', 'RGBA8',
      'FRAMEBUFFER_COMPLETE',
    ] as const;
    const seen = new Map<number, string>();
    for (const name of names) {
      const value = (gl as unknown as Record<string, number>)[name];
      expect(value, `${name} reads as 0 — the proxy's answer for a constant it does not know`)
        .not.toBe(0);
      expect(seen.get(value), `${name} collides with ${seen.get(value)}`).toBeUndefined();
      seen.set(value, name);
    }
  });

  it('gives SCISSOR_TEST a value distinct from the other capability flags', () => {
    const { gl } = createGLRecorder();
    expect(gl.SCISSOR_TEST).toBe(0x0C11);
    for (const other of [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE, gl.STENCIL_TEST]) {
      expect(gl.SCISSOR_TEST).not.toBe(other);
    }
  });

  it('reports drawing-buffer dimensions as numbers, not recording functions', () => {
    const { gl } = createGLRecorder({ drawingBufferWidth: 1640, drawingBufferHeight: 800 });
    expect(gl.drawingBufferWidth).toBe(1640);
    expect(gl.drawingBufferHeight).toBe(800);
    expect(gl.drawingBufferHeight - 100).toBe(700);
  });

  it('defaults the drawing buffer to a non-zero size', () => {
    const { gl } = createGLRecorder();
    expect(typeof gl.drawingBufferWidth).toBe('number');
    expect(gl.drawingBufferWidth).toBeGreaterThan(0);
  });

  it('reports context attributes, defaulting to a stencil buffer', () => {
    expect(createGLRecorder().gl.getContextAttributes()).toMatchObject({ stencil: true });
    const noStencil = createGLRecorder({ contextAttributes: { stencil: false } });
    expect(noStencil.gl.getContextAttributes()).toMatchObject({ stencil: false });
  });

  it('mints handles and locations that a reset does not repeat', () => {
    const recorder = createGLRecorder();
    const { gl } = recorder;
    const first = gl.createBuffer();
    const firstLoc = gl.getUniformLocation(gl.createProgram()!, 'u_x');
    recorder.reset();
    const second = gl.createBuffer();
    const secondLoc = gl.getUniformLocation(gl.createProgram()!, 'u_x');
    expect(second).not.toEqual(first);
    expect(secondLoc).not.toBe(firstLoc);
  });

  it('is not a thenable, so a promise resolves with it', async () => {
    const recorder = createGLRecorder();
    await expect(Promise.resolve(recorder.gl)).resolves.toBe(recorder.gl);
    expect(JSON.stringify({ gl: recorder.gl })).toBe('{"gl":{}}');
    expect(recorder.calls).toEqual([]);
  });

  it('records a method Object.prototype also names', () => {
    const recorder = createGLRecorder();
    (recorder.gl as unknown as { valueOf(): unknown }).valueOf();
    expect(recorder.calls.map((c) => c.name)).toEqual(['valueOf']);
  });
});

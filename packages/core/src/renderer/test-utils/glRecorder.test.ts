import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './glRecorder';

describe('glRecorder', () => {
  it('records method calls in order with args', () => {
    const { gl, calls } = makeGLRecorder();
    gl.viewport(0, 0, 800, 600);
    gl.clearColor(1, 0, 0, 1);

    expect(calls.length).toBe(2);
    expect(calls[0]).toMatchObject({ name: 'viewport', args: [0, 0, 800, 600] });
    expect(calls[1]).toMatchObject({ name: 'clearColor', args: [1, 0, 0, 1] });
  });

  it('returns synthetic handles for createShader / createProgram / createBuffer', () => {
    const { gl } = makeGLRecorder();
    const shader = gl.createShader(gl.VERTEX_SHADER);
    const program = gl.createProgram();
    expect(shader).toBeTruthy();
    expect(program).toBeTruthy();
    expect(shader).not.toBe(program);
  });

  it('returns truthy from getShaderParameter / getProgramParameter (assume success)', () => {
    const { gl } = makeGLRecorder();
    const shader = gl.createShader(gl.VERTEX_SHADER);
    expect(gl.getShaderParameter(shader!, gl.COMPILE_STATUS)).toBe(true);
  });

  it('exposes GL constants as numbers', () => {
    const { gl } = makeGLRecorder();
    expect(typeof gl.VERTEX_SHADER).toBe('number');
    expect(gl.VERTEX_SHADER).toBe(0x8B31);
  });

  it('reset() clears the call log', () => {
    const { gl, calls, reset } = makeGLRecorder();
    gl.viewport(0, 0, 1, 1);
    expect(calls.length).toBe(1);
    reset();
    expect(calls.length).toBe(0);
  });
});

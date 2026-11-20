import { describe, expect, it } from 'vitest';
import { createGLRecorder } from './glRecorder';
import { createUploadTracker } from './vertexUploads';

describe('createUploadTracker', () => {
  it('reads a tightly packed attribute at its own size', () => {
    const recorder = createGLRecorder();
    const { gl } = recorder;
    const tracker = createUploadTracker(recorder);
    const colors = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colors);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(8), gl.STATIC_DRAW);
    expect(tracker.uploads().map((u) => u.stride)).toEqual([4]);
  });

  it('reads an interleaved attribute at its byte stride', () => {
    const recorder = createGLRecorder();
    const { gl } = recorder;
    const tracker = createUploadTracker(recorder);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(12), gl.STATIC_DRAW);
    expect(tracker.uploads().map((u) => u.stride)).toEqual([6]);
  });
});

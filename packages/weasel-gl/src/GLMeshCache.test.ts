import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import type { Mesh } from './mesh';
import { GLMeshCache } from './GLMeshCache';

const sampleMesh: Mesh = {
  vertices: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

describe('GLMeshCache', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let cache: GLMeshCache;

  beforeEach(() => {
    recorder = makeGLRecorder();
    cache = new GLMeshCache(recorder.gl, /* aPositionLoc */ 0);
  });

  it('uploads VBO + IBO + VAO on first lookup', () => {
    cache.handleFor(sampleMesh);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('createBuffer');
    expect(names).toContain('createVertexArray');
    expect(names.filter((n) => n === 'bufferData').length).toBe(2); // one for VBO, one for IBO
    expect(names).toContain('vertexAttribPointer');
  });

  it('reuses the same handle on a second lookup with the same Mesh', () => {
    const a = cache.handleFor(sampleMesh);
    const b = cache.handleFor(sampleMesh);
    expect(a).toBe(b);
    // Only one set of create* calls.
    const createBufferCount = recorder.calls.filter((c) => c.name === 'createBuffer').length;
    expect(createBufferCount).toBe(2);
  });

  it('different Mesh objects upload separately', () => {
    cache.handleFor(sampleMesh);
    cache.handleFor({
      vertices: new Float32Array([0, 0, 1, 0, 1, 1]),
      indices: new Uint32Array([0, 1, 2]),
    });
    const createBufferCount = recorder.calls.filter((c) => c.name === 'createBuffer').length;
    expect(createBufferCount).toBe(4);
  });
});

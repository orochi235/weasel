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

  describe('transient resources', () => {
    it('uploadTransient does not register the mesh in the WeakMap cache', () => {
      const mesh: Mesh = {
        vertices: new Float32Array([0, 0, 1, 0, 1, 1]),
        indices: new Uint32Array([0, 1, 2]),
      };
      const a = cache.uploadTransient(mesh);
      const b = cache.uploadTransient(mesh);
      // Two separate handles — transient never caches.
      expect(a).not.toBe(b);
      expect(cache._transientCount()).toBe(2);
    });

    it('freeTransient deletes all transient resources and resets the list', () => {
      const mesh: Mesh = {
        vertices: new Float32Array([0, 0, 1, 0, 1, 1]),
        indices: new Uint32Array([0, 1, 2]),
      };
      cache.uploadTransient(mesh);
      cache.uploadTransient(mesh);
      const before = recorder.calls.length;
      cache.freeTransient();
      const after = recorder.calls.slice(before).map((c) => c.name);
      const vaoDel = after.filter((n) => n === 'deleteVertexArray').length;
      const bufDel = after.filter((n) => n === 'deleteBuffer').length;
      expect(vaoDel).toBe(2);
      expect(bufDel).toBe(4);
      expect(cache._transientCount()).toBe(0);
    });

    it('freeTransient is a no-op when nothing was uploaded transient', () => {
      const before = recorder.calls.length;
      cache.freeTransient();
      expect(recorder.calls.length).toBe(before);
    });
  });

  describe('deferred-delete queue', () => {
    it('starts with an empty pending queue', () => {
      expect(cache._pendingDeleteCount()).toBe(0);
    });

    it('drainPendingDeletes is a no-op when nothing is queued', () => {
      const before = recorder.calls.length;
      cache.drainPendingDeletes();
      // No new GL calls should have been made.
      expect(recorder.calls.length).toBe(before);
    });

    it('drainPendingDeletes calls deleteVertexArray + deleteBuffer x2 per queued resource', () => {
      // Simulate the finalizer firing for two meshes worth of resources.
      cache._enqueueDeleteForTest({
        vao: { __id: 'vao_x' } as unknown as WebGLVertexArrayObject,
        vbo: { __id: 'vbo_x' } as unknown as WebGLBuffer,
        ibo: { __id: 'ibo_x' } as unknown as WebGLBuffer,
      });
      cache._enqueueDeleteForTest({
        vao: { __id: 'vao_y' } as unknown as WebGLVertexArrayObject,
        vbo: { __id: 'vbo_y' } as unknown as WebGLBuffer,
        ibo: { __id: 'ibo_y' } as unknown as WebGLBuffer,
      });
      expect(cache._pendingDeleteCount()).toBe(2);

      cache.drainPendingDeletes();

      const names = recorder.calls.map((c) => c.name);
      const vaoDeletes = names.filter((n) => n === 'deleteVertexArray').length;
      const bufDeletes = names.filter((n) => n === 'deleteBuffer').length;
      expect(vaoDeletes).toBe(2);
      expect(bufDeletes).toBe(4); // two VBOs + two IBOs
      expect(cache._pendingDeleteCount()).toBe(0);
    });

    it('skips the actual delete calls when GL context is lost', () => {
      // Use a minimal proxy that reports context-lost = true and records
      // delete calls separately from the shared recorder.
      const deleteLog: string[] = [];
      const lostGl = new Proxy(
        {},
        {
          get(_, prop: string | symbol) {
            if (prop === 'isContextLost') return () => true;
            if (prop === 'deleteVertexArray' || prop === 'deleteBuffer') {
              return (...args: unknown[]) => {
                deleteLog.push(`${String(prop)}(${args.length})`);
              };
            }
            return () => undefined;
          },
        },
      ) as unknown as WebGL2RenderingContext;
      const lostCache = new GLMeshCache(lostGl, 0);
      lostCache._enqueueDeleteForTest({
        vao: { __id: 'vao_x' } as unknown as WebGLVertexArrayObject,
        vbo: { __id: 'vbo_x' } as unknown as WebGLBuffer,
        ibo: { __id: 'ibo_x' } as unknown as WebGLBuffer,
      });
      lostCache.drainPendingDeletes();
      expect(deleteLog).toEqual([]);
      // The queue should still be drained so we don't keep retrying.
      expect(lostCache._pendingDeleteCount()).toBe(0);
    });
  });
});

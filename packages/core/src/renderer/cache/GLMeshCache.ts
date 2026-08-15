import type { Mesh } from './mesh';

export interface GLMeshHandle {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
  readonly requiresStencil: boolean;
  readonly anchorA?: Uint32Array;
  readonly anchorB?: Uint32Array;
  readonly anchorT?: Float32Array;
}

/** Resources to release when a Mesh is reclaimed by GC. */
interface MeshResources {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
}

/**
 * Caches GL-side buffers + VAO per `Mesh` identity. Upload happens lazily
 * on first `handleFor(mesh)` call.
 *
 * **GC-aware cleanup (deferred-delete queue):** when a Mesh becomes
 * unreachable, the WeakMap entry is dropped automatically — but the
 * underlying GL resources (VAO, VBO, IBO) would leak forever without an
 * explicit `gl.delete*` call. We register each Mesh with a
 * `FinalizationRegistry`; when the Mesh is reclaimed, the finalizer pushes
 * the resources onto an internal queue. The renderer drains this queue at
 * the start of each `render()` call (via `drainPendingDeletes()`), when GL
 * is in a known state — no VAO bound, no draw mid-flight. Deleting from the
 * finalizer directly was racy (it could fire between two `gl.bindVertexArray`
 * calls inside `dispatch()`, sometimes corrupting the next draw); deferring
 * the actual delete to a known-safe point keeps the use-after-free risk to
 * zero.
 *
 * Caveats:
 *   - Finalizer timing is non-deterministic; resources may live for a frame
 *     or two beyond their Mesh, but they will be reclaimed.
 *   - If the GL context is lost between finalizer and drain, the drain
 *     no-ops safely (`gl.isContextLost()` makes deletes no-ops, and
 *     `gl.deleteBuffer(null)` is allowed).
 *
 * The cache is GL-context-bound; if the context is lost and re-created, the
 * renderer should construct a new GLMeshCache. (Context loss handling lives
 * in `WeaselRenderer`.)
 */
export class GLMeshCache {
  private readonly map = new WeakMap<Mesh, GLMeshHandle>();
  /** Meshes this context has drawn at least once; see `uploadRecurring`. */
  private readonly seen = new WeakSet<Mesh>();
  private readonly finalizer: FinalizationRegistry<MeshResources>;
  private readonly pendingDeletes: MeshResources[] = [];
  /** Transient resources allocated this frame; freed at end of render(). */
  private readonly transientThisFrame: MeshResources[] = [];

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly aPositionLoc: number,
  ) {
    this.finalizer = new FinalizationRegistry<MeshResources>((resources) => {
      // Defer the actual gl.delete* until the renderer's next render(),
      // when no VAO/buffer is bound mid-draw. Direct deletion from the
      // finalizer caused use-after-free crashes when GC fired between
      // bindVertexArray and drawElements inside dispatch().
      this.pendingDeletes.push(resources);
    });
  }

  handleFor(mesh: Mesh): GLMeshHandle {
    const cached = this.map.get(mesh);
    if (cached) return cached;
    const { handle, vbo, ibo } = this.upload(mesh);
    this.map.set(mesh, handle);
    // Register so the GL resources get freed when `mesh` is GC'd. The
    // unregister token (mesh) lets us cancel if the Mesh is somehow
    // re-uploaded under a different cache, though that's not a normal flow.
    this.finalizer.register(mesh, { vao: handle.vao, vbo, ibo }, mesh);
    return handle;
  }

  /**
   * Upload a Mesh that the caller knows is single-use (e.g. the per-frame
   * stroke ribbon from `tessellateStroke`). Returns a handle backed by fresh
   * GL resources that the renderer will free deterministically at the end
   * of the current frame via `freeTransient()`. Bypasses the WeakMap cache
   * and the FinalizationRegistry, so transient meshes never wait on GC.
   */
  uploadTransient(mesh: Mesh): GLMeshHandle {
    const { handle, vbo, ibo } = this.upload(mesh);
    this.transientThisFrame.push({ vao: handle.vao, vbo, ibo });
    return handle;
  }

  /**
   * Upload a Mesh that may or may not recur across frames. Its first sight in
   * *this* context takes `uploadTransient`; every later one takes the
   * persistent handle. One transient upload to find out is cheaper than
   * stranding a persistent VAO on a mesh that never returns, whose release
   * would wait on GC. The transient upload does not populate the persistent
   * map, so steady-state reuse begins on the third frame.
   */
  uploadRecurring(mesh: Mesh): GLMeshHandle {
    if (this.seen.has(mesh)) return this.handleFor(mesh);
    this.seen.add(mesh);
    return this.uploadTransient(mesh);
  }

  /**
   * Free all transient resources allocated since the last call. Called by
   * the renderer at the end of each `render()`. Safe under context loss.
   */
  freeTransient(): void {
    if (this.transientThisFrame.length === 0) return;
    const gl = this.gl;
    if (gl.isContextLost()) {
      this.transientThisFrame.length = 0;
      return;
    }
    for (const r of this.transientThisFrame) {
      gl.deleteVertexArray(r.vao);
      gl.deleteBuffer(r.vbo);
      gl.deleteBuffer(r.ibo);
    }
    this.transientThisFrame.length = 0;
  }

  /** @internal — for tests asserting the transient-list size. */
  _transientCount(): number {
    return this.transientThisFrame.length;
  }

  /**
   * Free GL resources whose Mesh has been GC'd since the last drain.
   * Called by the renderer at the top of each `render()`, before any draws.
   */
  drainPendingDeletes(): void {
    if (this.pendingDeletes.length === 0) return;
    const gl = this.gl;
    if (gl.isContextLost()) {
      this.pendingDeletes.length = 0;
      return;
    }
    for (const r of this.pendingDeletes) {
      gl.deleteVertexArray(r.vao);
      gl.deleteBuffer(r.vbo);
      gl.deleteBuffer(r.ibo);
    }
    this.pendingDeletes.length = 0;
  }

  /** @internal — for tests asserting the queue size. */
  _pendingDeleteCount(): number {
    return this.pendingDeletes.length;
  }

  /** @internal — for tests that need to simulate the finalizer firing. */
  _enqueueDeleteForTest(resources: MeshResources): void {
    this.pendingDeletes.push(resources);
  }

  private upload(mesh: Mesh): { handle: GLMeshHandle; vbo: WebGLBuffer; ibo: WebGLBuffer } {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray returned null');
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('createBuffer (VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(this.aPositionLoc);
    gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0);

    const ibo = gl.createBuffer();
    if (!ibo) throw new Error('createBuffer (IBO) returned null');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      handle: {
        vao,
        indexCount: mesh.indices.length,
        requiresStencil: mesh.requiresStencil ?? false,
        anchorA: mesh.anchorA,
        anchorB: mesh.anchorB,
        anchorT: mesh.anchorT,
      },
      vbo,
      ibo,
    };
  }
}

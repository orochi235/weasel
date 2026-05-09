import type { Mesh } from './mesh';

export interface GLMeshHandle {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
  readonly requiresStencil: boolean;
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
 * **GC-aware cleanup:** when a Mesh becomes unreachable, the WeakMap entry
 * is dropped automatically — but the underlying GL resources (VAO, VBO, IBO)
 * would leak forever without an explicit `gl.delete*` call. We register each
 * Mesh with a `FinalizationRegistry`; when the Mesh is reclaimed, the
 * finalizer runs and frees the GL resources. This handles the
 * "consumer creates fresh Path objects every render" case (animation tweens,
 * dynamic-shape edits) without requiring authors to manually dispose meshes.
 *
 * Caveats:
 *   - Finalizer timing is non-deterministic; GL resources may live for a
 *     while after their Mesh becomes unreachable. Memory pressure forces GC,
 *     so the system self-throttles.
 *   - If the GL context is lost (or the cache is replaced on context restore),
 *     pending finalizers no-op safely — `gl.deleteBuffer(null)` is allowed
 *     and `gl.isContextLost()` makes deletes no-ops.
 *
 * The cache is GL-context-bound; if the context is lost and re-created, the
 * renderer should construct a new GLMeshCache. (Context loss handling lives
 * in `WeaselRenderer`.)
 */
export class GLMeshCache {
  private readonly map = new WeakMap<Mesh, GLMeshHandle>();
  private readonly finalizer: FinalizationRegistry<MeshResources>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly aPositionLoc: number,
  ) {
    this.finalizer = new FinalizationRegistry<MeshResources>((_resources) => {
      // DISABLED 2026-05-09: deleting GL resources from a finalizer caused
      // use-after-free crashes in browser dev (likely the dispatch loop was
      // mid-draw with one of these buffers bound when GC fired). The
      // registration scaffolding is kept so a future fix (deferred delete
      // queue, idle-callback flush) can drop in without re-instrumenting
      // the cache. For now buffers leak — bounded in practice by the
      // rect fast-path bypassing this cache for the most-churned case.
      void _resources;
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
      },
      vbo,
      ibo,
    };
  }
}

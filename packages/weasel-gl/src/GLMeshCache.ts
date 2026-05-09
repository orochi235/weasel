import type { Mesh } from './mesh';

export interface GLMeshHandle {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
  readonly requiresStencil: boolean;
}

/**
 * Caches GL-side buffers + VAO per `Mesh` identity. Upload happens lazily
 * on first `handleFor(mesh)` call.
 *
 * The cache is GL-context-bound; if the context is lost and re-created, the
 * renderer should construct a new GLMeshCache. (Context loss handling lives
 * in `WeaselRenderer`.)
 */
export class GLMeshCache {
  private readonly map = new WeakMap<Mesh, GLMeshHandle>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly aPositionLoc: number,
  ) {}

  handleFor(mesh: Mesh): GLMeshHandle {
    const cached = this.map.get(mesh);
    if (cached) return cached;
    const handle = this.upload(mesh);
    this.map.set(mesh, handle);
    return handle;
  }

  private upload(mesh: Mesh): GLMeshHandle {
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
      vao,
      indexCount: mesh.indices.length,
      requiresStencil: mesh.requiresStencil ?? false,
    };
  }
}

/**
 * Growable vertex staging for consecutive solid-fill geometry.
 *
 * Geometry only: `draw.ts` owns when a run starts, what breaks it, and the
 * uniforms the flush draws under. Colors ride the vertices (the batch program
 * is `pathFillVColor` with `u_color` left at white) because shapes in a run
 * differ in color and a merged draw has one set of uniforms — and so does the
 * model transform, applied here rather than uploaded, so that shapes under
 * different transforms still share a draw.
 */

import type { Mesh } from './cache/mesh';
import type { Mat3 } from './math/mat3';
import type { ShaderProgram } from './shaders/ShaderProgram';

/** Vertices per flush. Caps staging memory; a longer run flushes in chunks,
 *  which stays correct because painter's order survives a flush. */
export const MAX_VERTICES_PER_BATCH = 32768;

const FLOATS_PER_VERTEX = 6; // vec2 a_position + vec4 a_vertexColor
const INITIAL_VERTICES = 256;
const INITIAL_INDICES = 384;

export class SolidBatch {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vbo: WebGLBuffer;
  private readonly ibo: WebGLBuffer;

  private verts = new Float32Array(INITIAL_VERTICES * FLOATS_PER_VERTEX);
  private idx = new Uint32Array(INITIAL_INDICES);
  private nVerts = 0;
  private nIdx = 0;
  /** What the GPU buffers are currently sized for. */
  private vboVerts = 0;
  private iboIdx = 0;

  constructor(gl: WebGL2RenderingContext, prog: ShaderProgram) {
    const aPos = prog.attribute('a_position');
    const aColor = prog.attribute('a_vertexColor');
    if (aPos === undefined || aColor === undefined) {
      throw new Error('SolidBatch: vertex-color program is missing a_position / a_vertexColor');
    }
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('SolidBatch: failed to create GL objects');
    this.gl = gl;
    this.vao = vao;
    this.vbo = vbo;
    this.ibo = ibo;

    const stride = FLOATS_PER_VERTEX * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bindVertexArray(null);
    this.growGpu(INITIAL_VERTICES, INITIAL_INDICES);
  }

  get length(): number {
    return this.nIdx;
  }

  /** Whether staging `vertices` more would put the run past the per-flush cap. */
  wouldOverflow(vertices: number): boolean {
    return this.nVerts + vertices > MAX_VERTICES_PER_BATCH;
  }

  /**
   * Append one rect's four corners through `m`, all carrying `rgba` (straight
   * alpha). An affine maps a rect to a parallelogram, so two triangles still
   * cover it and the batch draws at `u_model` identity.
   */
  pushRect(
    x: number, y: number, w: number, h: number, m: Mat3,
    r: number, g: number, b: number, a: number,
  ): void {
    this.reserve(4, 6);
    const v = this.verts;
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const ax = ma * x + mc * y + mtx,   ay = mb * x + md * y + mty;
    const bx = ma * x1 + mc * y + mtx,  by = mb * x1 + md * y + mty;
    const cx = ma * x1 + mc * y1 + mtx, cy = mb * x1 + md * y1 + mty;
    const dx = ma * x + mc * y1 + mtx,  dy = mb * x + md * y1 + mty;
    v[i++] = ax; v[i++] = ay; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = bx; v[i++] = by; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = cx; v[i++] = cy; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = dx; v[i++] = dy; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    const base = this.nVerts;
    let j = this.nIdx;
    this.idx[j++] = base;     this.idx[j++] = base + 1; this.idx[j++] = base + 2;
    this.idx[j++] = base;     this.idx[j++] = base + 2; this.idx[j++] = base + 3;
    this.nVerts += 4;
    this.nIdx += 6;
  }

  /**
   * Append a tessellated mesh through `m`, all vertices carrying `rgba`. The
   * mesh's own indices are rebased onto the staged vertices, which is why the
   * index buffer is uploaded per flush rather than written once.
   */
  pushMesh(
    mesh: Mesh, m: Mat3,
    r: number, g: number, b: number, a: number,
  ): void {
    const src = mesh.vertices;
    const srcIdx = mesh.indices;
    const n = src.length >> 1;
    this.reserve(n, srcIdx.length);
    const v = this.verts;
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    for (let k = 0; k < n; k++) {
      const x = src[k * 2];
      const y = src[k * 2 + 1];
      v[i++] = ma * x + mc * y + mtx;
      v[i++] = mb * x + md * y + mty;
      v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    }
    const base = this.nVerts;
    const out = this.idx;
    let j = this.nIdx;
    for (let k = 0; k < srcIdx.length; k++) out[j++] = base + srcIdx[k];
    this.nVerts += n;
    this.nIdx += srcIdx.length;
  }

  /** Upload the staged geometry and bind the batch VAO. Returns the index
   *  count for the caller's `drawElements`. */
  uploadAndBind(): number {
    const gl = this.gl;
    if (this.nVerts > this.vboVerts || this.nIdx > this.iboIdx) {
      this.growGpu(this.nVerts, this.nIdx);
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts, 0, this.nVerts * FLOATS_PER_VERTEX);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.idx, 0, this.nIdx);
    return this.nIdx;
  }

  reset(): void {
    this.nVerts = 0;
    this.nIdx = 0;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo);
    gl.deleteBuffer(this.ibo);
    gl.deleteVertexArray(this.vao);
  }

  /** Grow the CPU arrays so `vertices` / `indices` more fit. */
  private reserve(vertices: number, indices: number): void {
    const needVerts = (this.nVerts + vertices) * FLOATS_PER_VERTEX;
    if (needVerts > this.verts.length) {
      let len = this.verts.length;
      while (len < needVerts) len *= 2;
      const grown = new Float32Array(len);
      grown.set(this.verts);
      this.verts = grown;
    }
    const needIdx = this.nIdx + indices;
    if (needIdx > this.idx.length) {
      let len = this.idx.length;
      while (len < needIdx) len *= 2;
      const grown = new Uint32Array(len);
      grown.set(this.idx);
      this.idx = grown;
    }
  }

  /** Size both GPU buffers for at least what is staged, doubling to amortize. */
  private growGpu(vertices: number, indices: number): void {
    const gl = this.gl;
    if (vertices > this.vboVerts) {
      let capacity = Math.max(this.vboVerts, INITIAL_VERTICES);
      while (capacity < vertices) capacity *= 2;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, capacity * FLOATS_PER_VERTEX * 4, gl.DYNAMIC_DRAW);
      this.vboVerts = capacity;
    }
    if (indices > this.iboIdx) {
      let capacity = Math.max(this.iboIdx, INITIAL_INDICES);
      while (capacity < indices) capacity *= 2;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, capacity * 4, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);
      this.iboIdx = capacity;
    }
  }
}

/**
 * Growable vertex staging for consecutive solid-fill rects.
 *
 * Geometry only: `draw.ts` owns when a run starts, what breaks it, and the
 * uniforms the flush draws under. Colors ride the vertices (the batch program
 * is `pathFillVColor` with `u_color` left at white) because rects in a run
 * differ in color and a merged draw has one set of uniforms — and so does the
 * model transform, applied here rather than uploaded, so that rects under
 * different transforms still share a draw.
 */

import type { Mat3 } from './math/mat3';
import type { ShaderProgram } from './shaders/ShaderProgram';

/** Rects per flush. Caps staging memory; a longer run flushes in chunks,
 *  which stays correct because painter's order survives a flush. */
export const MAX_RECTS_PER_BATCH = 8192;

const FLOATS_PER_VERTEX = 6; // vec2 a_position + vec4 a_vertexColor
const FLOATS_PER_RECT = FLOATS_PER_VERTEX * 4;
const INDICES_PER_RECT = 6;
const INITIAL_RECTS = 64;

export class RectBatch {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vbo: WebGLBuffer;
  private readonly ibo: WebGLBuffer;

  private verts = new Float32Array(INITIAL_RECTS * FLOATS_PER_RECT);
  private rects = 0;
  /** Rects the GPU buffers are currently sized for. */
  private vboRects = 0;
  private iboRects = 0;

  constructor(gl: WebGL2RenderingContext, prog: ShaderProgram) {
    const aPos = prog.attribute('a_position');
    const aColor = prog.attribute('a_vertexColor');
    if (aPos === undefined || aColor === undefined) {
      throw new Error('RectBatch: vertex-color program is missing a_position / a_vertexColor');
    }
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('RectBatch: failed to create GL objects');
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
    this.growGpu(INITIAL_RECTS);
  }

  get length(): number {
    return this.rects;
  }

  /**
   * Append one rect's four corners through `m`, all carrying `rgba` (straight
   * alpha). An affine maps a rect to a parallelogram, so the two-triangle
   * index pattern still covers it and the batch draws at `u_model` identity.
   */
  push(
    x: number, y: number, w: number, h: number, m: Mat3,
    r: number, g: number, b: number, a: number,
  ): void {
    if (this.rects * FLOATS_PER_RECT === this.verts.length) {
      const grown = new Float32Array(this.verts.length * 2);
      grown.set(this.verts);
      this.verts = grown;
    }
    const v = this.verts;
    let i = this.rects * FLOATS_PER_RECT;
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
    this.rects += 1;
  }

  /** Upload the staged rects and bind the batch VAO. Returns the index count
   *  for the caller's `drawElements`. */
  uploadAndBind(): number {
    const gl = this.gl;
    if (this.rects > this.vboRects) this.growGpu(this.rects);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts, 0, this.rects * FLOATS_PER_RECT);
    return this.rects * INDICES_PER_RECT;
  }

  reset(): void {
    this.rects = 0;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo);
    gl.deleteBuffer(this.ibo);
    gl.deleteVertexArray(this.vao);
  }

  /** Size both GPU buffers for at least `rects`, doubling to amortize. The
   *  index content is a pure function of the rect index, so it is only
   *  rewritten when the buffer grows — never per flush. */
  private growGpu(rects: number): void {
    const gl = this.gl;
    let capacity = Math.max(this.vboRects, INITIAL_RECTS);
    while (capacity < rects) capacity *= 2;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * FLOATS_PER_RECT * 4, gl.DYNAMIC_DRAW);
    this.vboRects = capacity;

    if (capacity > this.iboRects) {
      const indices = new Uint32Array(capacity * INDICES_PER_RECT);
      for (let n = 0; n < capacity; n++) {
        const v = n * 4;
        const i = n * INDICES_PER_RECT;
        indices[i + 0] = v;     indices[i + 1] = v + 1; indices[i + 2] = v + 2;
        indices[i + 3] = v;     indices[i + 4] = v + 2; indices[i + 5] = v + 3;
      }
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.iboRects = capacity;
    }
  }
}

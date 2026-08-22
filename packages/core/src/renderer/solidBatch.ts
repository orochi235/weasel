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

/**
 * Flushes between one ring slot's write and its next.
 *
 * The driver tracks a write hazard per buffer object, so rewriting one buffer
 * before every flush makes each write wait on the draw still reading it — that
 * wait, not the draw, is what a flush costs. Measured per draw on an M2 Max via
 * ANGLE (`tests/perf/image-quad.spec.ts`): 40–80 us rewriting one buffer, 0.34
 * us for a ring of 64, 0.03 us for a buffer nothing writes. Writing disjoint
 * *ranges* of one buffer does not help — the hazard is per object.
 */
export const SOLID_RING_SIZE = 64;

/** What one ring slot holds. A bigger flush takes the large ring instead, which
 *  is what bounds this one's memory (~2.4 MB with every slot in use) however
 *  big a run gets. */
export const SOLID_RING_SLOT_VERTICES = 1024;
const SOLID_RING_SLOT_INDICES = 3072;

/** Slots for flushes past `SOLID_RING_SLOT_VERTICES`. These grow to fit, so
 *  they are few: a run that big is a run few things broke, and there are not
 *  many of them in a frame to cycle between. */
export const SOLID_LARGE_RING_SIZE = 4;

/** One VAO and the two buffers its attribute and element bindings name. */
interface BufferSet {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  /** What the GPU buffers are currently sized for. */
  vertexCapacity: number;
  indexCapacity: number;
}

function doubledTo(from: number, need: number): number {
  let capacity = from;
  while (capacity < need) capacity *= 2;
  return capacity;
}

export class SolidBatch {
  private readonly gl: WebGL2RenderingContext;
  private readonly aPos: number;
  private readonly aColor: number;

  /** Cycled per flush, and created on first use so a renderer that flushes
   *  rarely allocates as few slots as it flushes. */
  private readonly ring: (BufferSet | undefined)[] = new Array(SOLID_RING_SIZE).fill(undefined);
  private next = 0;
  /** The same, for flushes past a slot's capacity; these sets grow to fit. */
  private readonly largeRing: (BufferSet | undefined)[] =
    new Array(SOLID_LARGE_RING_SIZE).fill(undefined);
  private nextLarge = 0;

  private verts = new Float32Array(INITIAL_VERTICES * FLOATS_PER_VERTEX);
  private idx = new Uint32Array(INITIAL_INDICES);
  private nVerts = 0;
  private nIdx = 0;

  constructor(gl: WebGL2RenderingContext, prog: ShaderProgram) {
    const aPos = prog.attribute('a_position');
    const aColor = prog.attribute('a_vertexColor');
    if (aPos === undefined || aColor === undefined) {
      throw new Error('SolidBatch: vertex-color program is missing a_position / a_vertexColor');
    }
    this.gl = gl;
    this.aPos = aPos;
    this.aColor = aColor;
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

  /** Upload the staged geometry into the next set of buffers and bind its VAO.
   *  Returns the index count for the caller's `drawElements`. */
  uploadAndBind(): number {
    const gl = this.gl;
    const set = this.nVerts <= SOLID_RING_SLOT_VERTICES && this.nIdx <= SOLID_RING_SLOT_INDICES
      ? this.nextRingSlot()
      : this.nextLargeSlot();
    gl.bindVertexArray(set.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, set.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts, 0, this.nVerts * FLOATS_PER_VERTEX);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.idx, 0, this.nIdx);
    return this.nIdx;
  }

  reset(): void {
    this.nVerts = 0;
    this.nIdx = 0;
  }

  dispose(): void {
    for (const set of [...this.ring, ...this.largeRing]) {
      if (set) this.deleteSet(set);
    }
    this.ring.fill(undefined);
    this.largeRing.fill(undefined);
  }

  /** Grow the CPU arrays so `vertices` / `indices` more fit. */
  private reserve(vertices: number, indices: number): void {
    const needVerts = (this.nVerts + vertices) * FLOATS_PER_VERTEX;
    if (needVerts > this.verts.length) {
      const grown = new Float32Array(doubledTo(this.verts.length, needVerts));
      grown.set(this.verts);
      this.verts = grown;
    }
    const needIdx = this.nIdx + indices;
    if (needIdx > this.idx.length) {
      const grown = new Uint32Array(doubledTo(this.idx.length, needIdx));
      grown.set(this.idx);
      this.idx = grown;
    }
  }

  private nextRingSlot(): BufferSet {
    const slot = this.next;
    this.next = (slot + 1) % SOLID_RING_SIZE;
    const existing = this.ring[slot];
    if (existing) return existing;
    const set = this.createSet(SOLID_RING_SLOT_VERTICES, SOLID_RING_SLOT_INDICES);
    this.ring[slot] = set;
    return set;
  }

  private nextLargeSlot(): BufferSet {
    const gl = this.gl;
    const slot = this.nextLarge;
    this.nextLarge = (slot + 1) % SOLID_LARGE_RING_SIZE;
    let set = this.largeRing[slot];
    if (!set) {
      set = this.createSet(
        doubledTo(SOLID_RING_SLOT_VERTICES, this.nVerts),
        doubledTo(SOLID_RING_SLOT_INDICES, this.nIdx),
      );
      this.largeRing[slot] = set;
      return set;
    }
    if (this.nVerts > set.vertexCapacity) {
      set.vertexCapacity = doubledTo(set.vertexCapacity, this.nVerts);
      gl.bindBuffer(gl.ARRAY_BUFFER, set.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, set.vertexCapacity * FLOATS_PER_VERTEX * 4, gl.DYNAMIC_DRAW);
    }
    if (this.nIdx > set.indexCapacity) {
      set.indexCapacity = doubledTo(set.indexCapacity, this.nIdx);
      gl.bindVertexArray(set.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, set.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, set.indexCapacity * 4, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);
    }
    return set;
  }

  private createSet(vertices: number, indices: number): BufferSet {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('SolidBatch: failed to create GL objects');
    const stride = FLOATS_PER_VERTEX * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices * stride, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, stride, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices * 4, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, vertexCapacity: vertices, indexCapacity: indices };
  }

  private deleteSet(set: BufferSet): void {
    const gl = this.gl;
    gl.deleteBuffer(set.vbo);
    gl.deleteBuffer(set.ibo);
    gl.deleteVertexArray(set.vao);
  }
}

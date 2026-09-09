/**
 * Growable vertex staging for a run of solid-fill geometry and image quads.
 *
 * Geometry only: `draw.ts` owns when a run starts, what breaks it, and the
 * uniforms the flush draws under.
 *
 * **One batch for both, because a wall interleaves them.** A grid of
 * thumbnails is a ground rect under an atlas quad, per cell, and while solid
 * geometry and image quads staged separately each one had to drain the other
 * before it could stage — so a shape that batches perfectly in either half
 * alone paid a flush per command. Everything a vertex needs to say which it is
 * fits in the same vertex: solids carry the UV of a 1x1 white texel and are
 * their own color, quads carry their atlas UV and a white color. See
 * `shaders/batchFill.ts`.
 *
 * Colors ride the vertices because shapes in a run differ in color and a merged
 * draw has one set of uniforms — and so does the model transform, applied here
 * rather than uploaded, so shapes under different transforms still share a
 * draw. What the run cannot absorb is the texture: it samples one, which is why
 * an atlas is what makes a wall coalesce at all.
 */

import type { Mesh } from './cache/mesh';
import type { Mat3 } from './math/mat3';
import type { ShaderProgram } from './shaders/ShaderProgram';

/** Vertices per flush. Caps staging memory; a longer run flushes in chunks,
 *  which stays correct because painter's order survives a flush. */
export const MAX_VERTICES_PER_BATCH = 32768;

const FLOATS_PER_VERTEX = 9; // vec2 a_position + vec4 a_vertexColor + vec2 a_uv + float a_post
const INITIAL_VERTICES = 256;
const INITIAL_INDICES = 384;

/** UV of the white texel `draw.ts` binds when a run samples no image. Its
 *  texture is 1x1, so any coordinate lands on it; the center is the one that
 *  stays on it under either filter. */
export const WHITE_U = 0.5;
export const WHITE_V = 0.5;

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

/**
 * Slot sizes, smallest first. A flush takes the first it fits in.
 *
 * **Tiered because the hazard costs what the buffer is worth, not what the
 * write is.** A flush writing one quad into a slot the GPU is still reading
 * waits on the whole buffer object, and resolving that on a 36 KB buffer is far
 * dearer than on a 576-byte one. Measured on a frame of 20,000 quads that
 * nothing merged (`tests/perf/image-quad.spec.ts`): 92 ms with a 256-quad
 * smallest slot against 53 ms with a one-quad one, and a merged run unmoved
 * either way. The run that most wants a small buffer — one command, because the
 * next broke it — is exactly the run a batch is otherwise pure overhead for.
 */
export const BATCH_TIERS: readonly { vertices: number; indices: number }[] = [
  { vertices: 16, indices: 24 },
  { vertices: 1024, indices: 3072 },
];

/** What a standard slot holds, named for the tests and the flush-cost specs. */
export const SOLID_RING_SLOT_VERTICES = BATCH_TIERS[BATCH_TIERS.length - 1].vertices;

/** Slots for flushes past the largest tier. These grow to fit, so they are few:
 *  a run that big is a run few things broke, and there are not many of them in
 *  a frame to cycle between. */
export const SOLID_LARGE_RING_SIZE = 4;

/** One VAO and the two buffers its attribute and element bindings name. */
interface BufferSet {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  /** What the GPU buffers are currently sized for. */
  vertexCapacity: number;
  indexCapacity: number;
  /**
   * Quads for which this slot's element buffer holds the canonical pattern,
   * or 0 for contents that cannot be named that way (a mesh's rebased indices,
   * or a buffer just respecified).
   *
   * The pattern for N quads is a prefix of the pattern for any larger N, so a
   * slot written to its capacity serves every quad flush it ever takes and the
   * upload happens once per slot rather than once per flush — 0.89 us of the
   * 3.87 a flush costs (`tests/perf/flush-anatomy.spec.ts`). Rects and image
   * quads share it: both wind 0-1-2 / 0-2-3.
   */
  canonicalQuads: number;
}

function doubledTo(from: number, need: number): number {
  let capacity = from;
  while (capacity < need) capacity *= 2;
  return capacity;
}

/** The canonical quad index pattern for `quads` quads, as the push helpers
 *  wind them: two triangles over corners 0-1-2 and 0-2-3. */
function quadIndices(quads: number): Uint32Array {
  const out = new Uint32Array(quads * 6);
  for (let q = 0; q < quads; q++) {
    const b = q * 4;
    const j = q * 6;
    out[j] = b; out[j + 1] = b + 1; out[j + 2] = b + 2;
    out[j + 3] = b; out[j + 4] = b + 2; out[j + 5] = b + 3;
  }
  return out;
}

export class DrawBatch {
  private readonly gl: WebGL2RenderingContext;
  private readonly aPos: number;
  private readonly aColor: number;
  private readonly aUv: number;
  private readonly aPost: number;

  /** One ring per tier, cycled per flush. Slots are created on first use, so a
   *  renderer that flushes rarely allocates as few as it flushes. */
  private readonly rings: (BufferSet | undefined)[][] =
    BATCH_TIERS.map(() => new Array(SOLID_RING_SIZE).fill(undefined));
  private readonly nextInRing: number[] = BATCH_TIERS.map(() => 0);
  /** The same, for flushes past the largest tier; these sets grow to fit. */
  private readonly largeRing: (BufferSet | undefined)[] =
    new Array(SOLID_LARGE_RING_SIZE).fill(undefined);
  private nextLarge = 0;

  private verts = new Float32Array(INITIAL_VERTICES * FLOATS_PER_VERTEX);
  private idx = new Uint32Array(INITIAL_INDICES);
  private nVerts = 0;
  private nIdx = 0;
  /** Whether the staged run is quads alone, so its indices are the canonical
   *  pattern and a slot already holding that pattern needs no upload. */
  private pureRects = true;

  constructor(gl: WebGL2RenderingContext, prog: ShaderProgram) {
    const aPos = prog.attribute('a_position');
    const aColor = prog.attribute('a_vertexColor');
    const aUv = prog.attribute('a_uv');
    const aPost = prog.attribute('a_post');
    if (aPos === undefined || aColor === undefined || aUv === undefined || aPost === undefined) {
      throw new Error(
        'DrawBatch: batch program is missing a_position / a_vertexColor / a_uv / a_post',
      );
    }
    this.gl = gl;
    this.aPos = aPos;
    this.aColor = aColor;
    this.aUv = aUv;
    this.aPost = aPost;
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
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const ax = ma * x + mc * y + mtx,   ay = mb * x + md * y + mty;
    const bx = ma * x1 + mc * y + mtx,  by = mb * x1 + md * y + mty;
    const cx = ma * x1 + mc * y1 + mtx, cy = mb * x1 + md * y1 + mty;
    const dx = ma * x + mc * y1 + mtx,  dy = mb * x + md * y1 + mty;
    i = this.writeVertex(i, ax, ay, r, g, b, a, WHITE_U, WHITE_V, 1);
    i = this.writeVertex(i, bx, by, r, g, b, a, WHITE_U, WHITE_V, 1);
    i = this.writeVertex(i, cx, cy, r, g, b, a, WHITE_U, WHITE_V, 1);
    this.writeVertex(i, dx, dy, r, g, b, a, WHITE_U, WHITE_V, 1);
    this.pushQuadIndices();
  }

  /**
   * Append one image quad: the destination rect `(x, y, w, h)` mapped through
   * `m`, sampling `(u0, v0)`-`(u1, v1)`, every corner carrying `post` as the
   * after-the-color-matrix alpha factor.
   *
   * Corners wind top-left, top-right, bottom-right, bottom-left with UVs
   * following — the same winding `pushRect` uses, which is what lets a run of
   * mixed rects and quads keep the canonical index pattern. The flips a command
   * asks for are already in the `u` / `v` the caller passes.
   */
  pushQuad(
    x: number, y: number, w: number, h: number, m: Mat3,
    u0: number, v0: number, u1: number, v1: number,
    post: number,
  ): void {
    this.reserve(4, 6);
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const ax = ma * x + mc * y + mtx,   ay = mb * x + md * y + mty;
    const bx = ma * x1 + mc * y + mtx,  by = mb * x1 + md * y + mty;
    const cx = ma * x1 + mc * y1 + mtx, cy = mb * x1 + md * y1 + mty;
    const dx = ma * x + mc * y1 + mtx,  dy = mb * x + md * y1 + mty;
    i = this.writeVertex(i, ax, ay, 1, 1, 1, 1, u0, v0, post);
    i = this.writeVertex(i, bx, by, 1, 1, 1, 1, u1, v0, post);
    i = this.writeVertex(i, cx, cy, 1, 1, 1, 1, u1, v1, post);
    this.writeVertex(i, dx, dy, 1, 1, 1, 1, u0, v1, post);
    this.pushQuadIndices();
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
    this.pureRects = false;
    const v = this.verts;
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    for (let k = 0; k < n; k++) {
      const x = src[k * 2];
      const y = src[k * 2 + 1];
      v[i++] = ma * x + mc * y + mtx;
      v[i++] = mb * x + md * y + mty;
      v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
      v[i++] = WHITE_U; v[i++] = WHITE_V; v[i++] = 1;
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
    const tier = BATCH_TIERS.findIndex(
      (t) => this.nVerts <= t.vertices && this.nIdx <= t.indices,
    );
    const set = tier < 0 ? this.nextLargeSlot() : this.nextRingSlot(tier);
    gl.bindVertexArray(set.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, set.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts, 0, this.nVerts * FLOATS_PER_VERTEX);
    if (!this.pureRects) {
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.idx, 0, this.nIdx);
      set.canonicalQuads = 0;
    } else if (set.canonicalQuads < this.nVerts >> 2) {
      // Written to the slot's capacity, not this flush's length: the extra
      // costs one upload the slot never repeats.
      const quads = Math.min(set.vertexCapacity >> 2, Math.floor(set.indexCapacity / 6));
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, quadIndices(quads));
      set.canonicalQuads = quads;
    }
    return this.nIdx;
  }

  reset(): void {
    this.nVerts = 0;
    this.nIdx = 0;
    this.pureRects = true;
  }

  dispose(): void {
    for (const set of [...this.rings.flat(), ...this.largeRing]) {
      if (set) this.deleteSet(set);
    }
    for (const ring of this.rings) ring.fill(undefined);
    this.largeRing.fill(undefined);
  }

  private writeVertex(
    i: number,
    x: number, y: number,
    r: number, g: number, b: number, a: number,
    u: number, v: number, post: number,
  ): number {
    const out = this.verts;
    out[i] = x; out[i + 1] = y;
    out[i + 2] = r; out[i + 3] = g; out[i + 4] = b; out[i + 5] = a;
    out[i + 6] = u; out[i + 7] = v; out[i + 8] = post;
    return i + FLOATS_PER_VERTEX;
  }

  /** Two triangles over the four corners just written. */
  private pushQuadIndices(): void {
    const base = this.nVerts;
    let j = this.nIdx;
    this.idx[j++] = base;     this.idx[j++] = base + 1; this.idx[j++] = base + 2;
    this.idx[j++] = base;     this.idx[j++] = base + 2; this.idx[j++] = base + 3;
    this.nVerts += 4;
    this.nIdx += 6;
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

  private nextRingSlot(tier: number): BufferSet {
    const ring = this.rings[tier];
    const slot = this.nextInRing[tier];
    this.nextInRing[tier] = (slot + 1) % ring.length;
    const existing = ring[slot];
    if (existing) return existing;
    const set = this.createSet(BATCH_TIERS[tier].vertices, BATCH_TIERS[tier].indices);
    ring[slot] = set;
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
        doubledTo(BATCH_TIERS[BATCH_TIERS.length - 1].indices, this.nIdx),
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
      // Respecified, so whatever pattern it held is gone.
      set.canonicalQuads = 0;
    }
    return set;
  }

  private createSet(vertices: number, indices: number): BufferSet {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('DrawBatch: failed to create GL objects');
    const stride = FLOATS_PER_VERTEX * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices * stride, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(this.aPost);
    gl.vertexAttribPointer(this.aPost, 1, gl.FLOAT, false, stride, 32);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices * 4, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, vertexCapacity: vertices, indexCapacity: indices, canonicalQuads: 0 };
  }

  private deleteSet(set: BufferSet): void {
    const gl = this.gl;
    gl.deleteBuffer(set.vbo);
    gl.deleteBuffer(set.ibo);
    gl.deleteVertexArray(set.vao);
  }
}

/**
 * Growable vertex staging for consecutive image quads.
 *
 * Geometry only: `draw.ts` owns when a run starts, what breaks it, and the
 * uniforms the flush draws under. The counterpart to `SolidBatch`, and the same
 * two tricks — the model transform is applied here rather than uploaded, so
 * quads under different group transforms still share a draw, and opacity rides
 * the vertices, so quads under different opacities do too. What it cannot
 * absorb is the texture: a batch samples one, which is why an atlas is what
 * makes a large run coalesce at all.
 *
 * Every run is quads, so a slot's index buffer is written once at creation and
 * never again: the pattern for N quads is a prefix of the pattern for any
 * larger N, so the pattern for a slot's capacity serves every flush it takes.
 * `SolidBatch` carries meshes, whose indices are rebased per flush, and has to
 * re-upload; this does not.
 */

import type { Mat3 } from './math/mat3';
import type { ShaderProgram } from './shaders/ShaderProgram';

/** Vertices per flush. Caps staging memory; a longer run flushes in chunks,
 *  which stays correct because painter's order survives a flush. */
export const MAX_IMAGE_VERTICES_PER_BATCH = 32768;

const FLOATS_PER_VERTEX = 5; // vec2 a_position + vec2 a_uv + float a_opacity
const INITIAL_QUADS = 64;

/**
 * Slot size, in quads, and how many slots that size cycles. A flush takes the
 * first tier it fits in; anything past the last takes `largeRing`.
 *
 * **Tiered because the hazard costs what the buffer is worth, not what the
 * write is.** The driver tracks a write hazard per buffer object, so a flush
 * writing 80 bytes into a slot the GPU is still reading waits on the whole
 * object, and resolving that on a 20 KB buffer is far dearer than on an 80-byte
 * one. Measured on an M2 Max via ANGLE (`tests/perf/image-quad.spec.ts`), on a
 * frame of 20,000 quads that nothing merges: 92 ms with a 256-quad smallest
 * slot, 53 ms with a one-quad one, and a merged run unmoved either way. One
 * slot size therefore has to be wrong at one end, and the run that most wants a
 * small buffer — one quad, because the next command broke it — is exactly the
 * run a batch is otherwise pure overhead for.
 *
 * A run long enough to want a big slot is a run few things broke, so there are
 * correspondingly few of those flushes in a frame to cycle between.
 */
const TIERS: readonly { quads: number; slots: number }[] = [
  { quads: 1, slots: 64 },
  { quads: 16, slots: 64 },
  { quads: 256, slots: 16 },
];

/** Slots in the smallest tier — how many flushes pass before a one-quad run
 *  writes the same buffer again. */
export const IMAGE_RING_SIZE = TIERS[0].slots;

/** Slots for flushes past the largest tier. These grow to fit. */
export const IMAGE_LARGE_RING_SIZE = 4;

/** One VAO and the two buffers its attribute and element bindings name. */
interface BufferSet {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  /** Quads the GPU buffers are currently sized for. */
  quadCapacity: number;
}

function doubledTo(from: number, need: number): number {
  let capacity = from;
  while (capacity < need) capacity *= 2;
  return capacity;
}

/** The canonical quad index pattern for `quads` quads, as `pushQuad` winds
 *  them: two triangles over corners 0-1-2 and 0-2-3. */
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

export class ImageBatch {
  private readonly gl: WebGL2RenderingContext;
  private readonly aPos: number;
  private readonly aUv: number;
  private readonly aOpacity: number;

  /** One ring per tier, cycled per flush. Slots are created on first use, so a
   *  renderer that flushes rarely allocates as few as it flushes. */
  private readonly rings: (BufferSet | undefined)[][] =
    TIERS.map((t) => new Array(t.slots).fill(undefined));
  private readonly nextInRing: number[] = TIERS.map(() => 0);
  /** For flushes past the largest tier; these sets grow to fit. */
  private readonly largeRing: (BufferSet | undefined)[] =
    new Array(IMAGE_LARGE_RING_SIZE).fill(undefined);
  private nextLarge = 0;

  private verts = new Float32Array(INITIAL_QUADS * 4 * FLOATS_PER_VERTEX);
  private nQuads = 0;

  constructor(gl: WebGL2RenderingContext, prog: ShaderProgram) {
    const aPos = prog.attribute('a_position');
    const aUv = prog.attribute('a_uv');
    const aOpacity = prog.attribute('a_opacity');
    if (aPos === undefined || aUv === undefined || aOpacity === undefined) {
      throw new Error(
        'ImageBatch: vertex-opacity program is missing a_position / a_uv / a_opacity',
      );
    }
    this.gl = gl;
    this.aPos = aPos;
    this.aUv = aUv;
    this.aOpacity = aOpacity;
  }

  /** Indices staged — what a caller passes to `drawElements`. */
  get length(): number {
    return this.nQuads * 6;
  }

  get quads(): number {
    return this.nQuads;
  }

  /** Whether staging one more quad would put the run past the per-flush cap. */
  wouldOverflow(): boolean {
    return (this.nQuads + 1) * 4 > MAX_IMAGE_VERTICES_PER_BATCH;
  }

  /**
   * Append one image quad: the destination rect `(x, y, w, h)` mapped through
   * `m`, sampling `(u0, v0)`-`(u1, v1)`, every corner carrying `opacity`.
   *
   * An affine maps a rect to a parallelogram, so two triangles still cover it
   * and the batch draws at `u_model` identity. Corners wind top-left,
   * top-right, bottom-right, bottom-left, with UVs following — the flips a
   * command asks for are already in the `u`/`v` the caller passes.
   */
  pushQuad(
    x: number, y: number, w: number, h: number, m: Mat3,
    u0: number, v0: number, u1: number, v1: number,
    opacity: number,
  ): void {
    this.reserve();
    const v = this.verts;
    let i = this.nQuads * 4 * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const ax = ma * x + mc * y + mtx,   ay = mb * x + md * y + mty;
    const bx = ma * x1 + mc * y + mtx,  by = mb * x1 + md * y + mty;
    const cx = ma * x1 + mc * y1 + mtx, cy = mb * x1 + md * y1 + mty;
    const dx = ma * x + mc * y1 + mtx,  dy = mb * x + md * y1 + mty;
    v[i++] = ax; v[i++] = ay; v[i++] = u0; v[i++] = v0; v[i++] = opacity;
    v[i++] = bx; v[i++] = by; v[i++] = u1; v[i++] = v0; v[i++] = opacity;
    v[i++] = cx; v[i++] = cy; v[i++] = u1; v[i++] = v1; v[i++] = opacity;
    v[i++] = dx; v[i++] = dy; v[i++] = u0; v[i++] = v1; v[i++] = opacity;
    this.nQuads += 1;
  }

  /** Upload the staged geometry into the next set of buffers and bind its VAO.
   *  Returns the index count for the caller's `drawElements`. */
  uploadAndBind(): number {
    const gl = this.gl;
    const tier = TIERS.findIndex((t) => this.nQuads <= t.quads);
    const set = tier < 0 ? this.nextLargeSlot() : this.nextRingSlot(tier);
    gl.bindVertexArray(set.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, set.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts, 0, this.nQuads * 4 * FLOATS_PER_VERTEX);
    return this.nQuads * 6;
  }

  reset(): void {
    this.nQuads = 0;
  }

  dispose(): void {
    for (const set of [...this.rings.flat(), ...this.largeRing]) {
      if (set) this.deleteSet(set);
    }
    for (const ring of this.rings) ring.fill(undefined);
    this.largeRing.fill(undefined);
  }

  /** Grow the CPU arrays so one more quad fits. */
  private reserve(): void {
    const need = (this.nQuads + 1) * 4 * FLOATS_PER_VERTEX;
    if (need <= this.verts.length) return;
    const grown = new Float32Array(doubledTo(this.verts.length, need));
    grown.set(this.verts);
    this.verts = grown;
  }

  private nextRingSlot(tier: number): BufferSet {
    const ring = this.rings[tier];
    const slot = this.nextInRing[tier];
    this.nextInRing[tier] = (slot + 1) % ring.length;
    const existing = ring[slot];
    if (existing) return existing;
    const set = this.createSet(TIERS[tier].quads);
    ring[slot] = set;
    return set;
  }

  private nextLargeSlot(): BufferSet {
    const gl = this.gl;
    const slot = this.nextLarge;
    this.nextLarge = (slot + 1) % IMAGE_LARGE_RING_SIZE;
    let set = this.largeRing[slot];
    if (!set) {
      set = this.createSet(doubledTo(TIERS[TIERS.length - 1].quads, this.nQuads));
      this.largeRing[slot] = set;
      return set;
    }
    if (this.nQuads > set.quadCapacity) {
      set.quadCapacity = doubledTo(set.quadCapacity, this.nQuads);
      gl.bindVertexArray(set.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, set.vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER, set.quadCapacity * 4 * FLOATS_PER_VERTEX * 4, gl.DYNAMIC_DRAW,
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, set.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices(set.quadCapacity), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
    }
    return set;
  }

  private createSet(quads: number): BufferSet {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('ImageBatch: failed to create GL objects');
    const stride = FLOATS_PER_VERTEX * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quads * 4 * stride, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(this.aOpacity);
    gl.vertexAttribPointer(this.aOpacity, 1, gl.FLOAT, false, stride, 16);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices(quads), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, quadCapacity: quads };
  }

  private deleteSet(set: BufferSet): void {
    const gl = this.gl;
    gl.deleteBuffer(set.vbo);
    gl.deleteBuffer(set.ibo);
    gl.deleteVertexArray(set.vao);
  }
}

/**
 * The GPU buffers a `DrawBatch` flush uploads into: rings of vertex and index
 * buffer pairs, cycled per flush and tiered by size, each wrapped in the
 * geometry the batch program draws from.
 */

import type { ShaderProgram } from './shaders/ShaderProgram';
import type { GpuBuffer, GpuDevice, GpuGeometry } from './gpu/types';
import { FLOATS_PER_VERTEX, doubledTo } from './batchStage';

/**
 * Flushes between one ring slot's write and its next. Sized for a driver that
 * tracks a write hazard per buffer object, where rewriting one buffer before
 * every flush makes each write wait on the draw still reading it.
 * `tests/perf/image-quad.spec.ts` measures it.
 */
export const SOLID_RING_SIZE = 64;

/**
 * Slot sizes, smallest first. A flush takes the first it fits in.
 *
 * **Tiered because a write into a big slot costs more than the same write into
 * a small one**, and the run that most wants a small buffer — one command,
 * because the next broke it — is exactly the run a batch is otherwise pure
 * overhead for. `tests/perf/image-quad.spec.ts` (`renderer/unmerged`) measures it.
 */
export const BATCH_TIERS: readonly { vertices: number; indices: number }[] = [
  { vertices: 16, indices: 24 },
  { vertices: 1024, indices: 3072 },
];

/** What a standard slot holds, named for the tests and the flush-cost specs. */
export const SOLID_RING_SLOT_VERTICES = BATCH_TIERS[BATCH_TIERS.length - 1].vertices;

/** Slots for flushes past the largest tier. These grow to fit, so they are few. */
export const SOLID_LARGE_RING_SIZE = 4;

/** One geometry and the two buffers it draws from. */
interface BufferSet {
  geometry: GpuGeometry;
  vbo: GpuBuffer;
  ibo: GpuBuffer;
  /** What the GPU buffers are currently sized for. */
  vertexCapacity: number;
  indexCapacity: number;
  /**
   * Quads for which this slot's element buffer holds the canonical pattern,
   * or 0 for contents that cannot be named that way (a mesh's rebased indices,
   * or a buffer just respecified).
   *
   * The pattern for N quads is a prefix of the pattern for any larger N, so a
   * slot written to its capacity serves every quad flush it ever takes.
   */
  canonicalQuads: number;
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

export class BatchBuffers {
  private readonly gpu: GpuDevice;
  private readonly aPos: number;
  private readonly aColor: number;
  private readonly aUv: number;
  private readonly aPost: number;
  private readonly aSlot: number;

  /** One ring per tier, cycled per flush. Slots are created on first use, so a
   *  renderer that flushes rarely allocates as few as it flushes. */
  private readonly rings: (BufferSet | undefined)[][] =
    BATCH_TIERS.map(() => new Array(SOLID_RING_SIZE).fill(undefined));
  private readonly nextInRing: number[] = BATCH_TIERS.map(() => 0);
  /** The same, for flushes past the largest tier; these sets grow to fit. */
  private readonly largeRing: (BufferSet | undefined)[] =
    new Array(SOLID_LARGE_RING_SIZE).fill(undefined);
  private nextLarge = 0;

  constructor(gpu: GpuDevice, prog: ShaderProgram) {
    const aPos = prog.attribute('a_position');
    const aColor = prog.attribute('a_vertexColor');
    const aUv = prog.attribute('a_uv');
    const aPost = prog.attribute('a_post');
    const aSlot = prog.attribute('a_texSlot');
    if (aPos === undefined || aColor === undefined || aUv === undefined
        || aPost === undefined || aSlot === undefined) {
      throw new Error(
        'DrawBatch: batch program is missing a_position / a_vertexColor / a_uv / '
        + 'a_post / a_texSlot',
      );
    }
    this.gpu = gpu;
    this.aPos = aPos;
    this.aColor = aColor;
    this.aUv = aUv;
    this.aPost = aPost;
    this.aSlot = aSlot;
  }

  /**
   * Upload `nVerts` vertices of `verts` and `nIdx` indices of `idx` into the
   * next set of buffers, and return the geometry a draw of them names and its
   * index count. `pureRects` says the indices are the canonical quad pattern,
   * which a slot that already holds it need not be sent again.
   */
  upload(
    verts: Float32Array, nVerts: number, idx: Uint32Array, nIdx: number, pureRects: boolean,
  ): { geometry: GpuGeometry; count: number } {
    const gpu = this.gpu;
    const tier = BATCH_TIERS.findIndex((t) => nVerts <= t.vertices && nIdx <= t.indices);
    const set = tier < 0 ? this.nextLargeSlot(nVerts, nIdx) : this.nextRingSlot(tier);
    gpu.writeBuffer(set.vbo, 0, verts, 0, nVerts * FLOATS_PER_VERTEX);
    if (!pureRects) {
      gpu.writeBuffer(set.ibo, 0, idx, 0, nIdx);
      set.canonicalQuads = 0;
    } else if (set.canonicalQuads < nVerts >> 2) {
      // Written to the slot's capacity, not this flush's length: the extra
      // costs one upload the slot never repeats.
      const quads = Math.min(set.vertexCapacity >> 2, Math.floor(set.indexCapacity / 6));
      gpu.writeBuffer(set.ibo, 0, quadIndices(quads));
      set.canonicalQuads = quads;
    }
    return { geometry: set.geometry, count: nIdx };
  }

  dispose(): void {
    for (const set of [...this.rings.flat(), ...this.largeRing]) {
      if (set) this.deleteSet(set);
    }
    for (const ring of this.rings) ring.fill(undefined);
    this.largeRing.fill(undefined);
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

  private nextLargeSlot(nVerts: number, nIdx: number): BufferSet {
    const slot = this.nextLarge;
    this.nextLarge = (slot + 1) % SOLID_LARGE_RING_SIZE;
    let set = this.largeRing[slot];
    if (!set) {
      set = this.createSet(
        doubledTo(SOLID_RING_SLOT_VERTICES, nVerts),
        doubledTo(BATCH_TIERS[BATCH_TIERS.length - 1].indices, nIdx),
      );
      this.largeRing[slot] = set;
      return set;
    }
    if (nVerts > set.vertexCapacity) {
      set.vertexCapacity = doubledTo(set.vertexCapacity, nVerts);
      this.gpu.resizeBuffer(set.vbo, set.vertexCapacity * FLOATS_PER_VERTEX * 4, 'dynamic');
    }
    if (nIdx > set.indexCapacity) {
      set.indexCapacity = doubledTo(set.indexCapacity, nIdx);
      this.gpu.resizeBuffer(set.ibo, set.indexCapacity * 4, 'dynamic');
      // Respecified, so whatever pattern it held is gone.
      set.canonicalQuads = 0;
    }
    return set;
  }

  private createSet(vertices: number, indices: number): BufferSet {
    const gpu = this.gpu;
    const stride = FLOATS_PER_VERTEX * 4;
    const vbo = gpu.createBuffer('vertex', vertices * stride, 'dynamic');
    const ibo = gpu.createBuffer('index', indices * 4, 'dynamic');
    const geometry = gpu.createGeometry({
      vertexBuffers: [{
        buffer: vbo, stride, attributes: [
          { location: this.aPos, components: 2, offset: 0 },
          { location: this.aColor, components: 4, offset: 8 },
          { location: this.aUv, components: 2, offset: 24 },
          { location: this.aPost, components: 1, offset: 32 },
          { location: this.aSlot, components: 1, offset: 36 },
        ],
      }],
      indexBuffer: ibo,
      indexFormat: 'uint32',
    });
    return { geometry, vbo, ibo, vertexCapacity: vertices, indexCapacity: indices, canonicalQuads: 0 };
  }

  private deleteSet(set: BufferSet): void {
    const gpu = this.gpu;
    gpu.deleteGeometry(set.geometry);
    gpu.deleteBuffer(set.vbo);
    gpu.deleteBuffer(set.ibo);
  }
}

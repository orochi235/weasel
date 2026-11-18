/**
 * Growable vertex staging for a run of solid-fill geometry, image quads and
 * glyphs. Geometry only: the caller owns when a run starts, what breaks it, and
 * the uniforms the flush draws under.
 *
 * One batch for all of them, because a page interleaves them. Everything a
 * vertex needs to say which it is fits in the same vertex: solids carry the UV
 * of a 1x1 white texel and are their own color, quads carry their atlas UV and
 * a white color, glyphs carry a font atlas UV, their text color, and a paint
 * mode saying the texel is a distance field rather than a color. Gradients
 * sample the ramp atlas. See `shaders/batchFill.ts`.
 *
 * The model transform is applied here rather than uploaded, so shapes under
 * different transforms still share a draw. The texture rides the vertices as a
 * slot index into the units the flush binds: slot 0 is the white texel every
 * solid samples.
 */

import type { Mesh } from '@weasel-js/geom/tessellate';
import type { GlMat3 } from '@weasel-js/geom';
import type { ShaderProgram } from './shaders/ShaderProgram';
import type { GpuDevice, GpuGeometry } from './gpu/types';
import { PAINT_MODE_IMAGE, PAINT_MODE_PLAIN, packSlot } from './shaders/batchFill';
import { BatchStage, FLOATS_PER_VERTEX } from './batchStage';
import { BatchBuffers } from './batchBuffers';
import { placeGlyph, type PlacedGlyph } from './glyphCorners';
import { GLYPH_CORNER_POST } from './shaders/glyphCell';

/** Vertices per flush. Caps staging memory; a longer run flushes in chunks,
 *  which stays correct because painter's order survives a flush. */
export const MAX_VERTICES_PER_BATCH = 32768;

export { FLOATS_PER_VERTEX };

/** Float offset of `a_texSlot` within a vertex, which carries the paint mode
 *  packed alongside the slot — `paintModeOf` unpacks it. */
export const TEX_SLOT_OFFSET = 9;
/** The quad `pushGlyph` places, read before the next glyph's is written. */
const PLACED: PlacedGlyph = { xy: new Array<number>(8).fill(0), uv: [0, 0, 0, 0] };
const NO_CORNERS: readonly number[] = [0, 0, 0, 0];

/** UV of the white texel bound at slot 0. Its texture is 1x1, so any
 *  coordinate lands on it; the center is the one that stays on it under either
 *  filter. */
export const WHITE_U = 0.5;
export const WHITE_V = 0.5;

/**
 * A gradient vertex's `a_uv`, each channel affine in the coordinates the
 * geometry arrives in: `u = ux*x + uy*y + u0`, and the same for `v`.
 *
 * A linear gradient's `v` row is the constant atlas row and its `u` row is the
 * ramp position; a radial or conic one's two rows are the gradient-space
 * coordinate, and the atlas row rides `a_post` instead.
 */
export interface GradientUV {
  ux: number; uy: number; u0: number;
  vx: number; vy: number; v0: number;
}

/** Every vertex on the white texel, which is how a solid mesh is a gradient one. */
const SOLID_UV: GradientUV = { ux: 0, uy: 0, u0: WHITE_U, vx: 0, vy: 0, v0: WHITE_V };

export {
  BATCH_TIERS, SOLID_LARGE_RING_SIZE, SOLID_RING_SIZE, SOLID_RING_SLOT_VERTICES,
} from './batchBuffers';

export class DrawBatch extends BatchStage {
  private readonly buffers: BatchBuffers;

  constructor(gpu: GpuDevice, prog: ShaderProgram) {
    super();
    this.buffers = new BatchBuffers(gpu, prog);
  }

  get length(): number {
    return this.nIdx;
  }

  /** Whether staging `vertices` more would put the run past the per-flush cap. */
  wouldOverflow(vertices: number): boolean {
    return this.nVerts + vertices > MAX_VERTICES_PER_BATCH;
  }

  /**
   * Append one rect's four corners through `m`, all carrying `rgba` (straight alpha, as one array: four fractions
   * passed apart were four heap numbers a rect) and `P` in `a_texSlot`: the white texel, and the run's matrix.
   */
  pushRect(
    x: number, y: number, w: number, h: number, m: GlMat3, rgba: readonly [number, number, number, number], P: number,
  ): boolean {
    const r = rgba[0], g = rgba[1], b = rgba[2], a = rgba[3];
    this.reserve(4, 6);
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const ax = ma * x + mc * y + mtx,   ay = mb * x + md * y + mty;
    const bx = ma * x1 + mc * y + mtx,  by = mb * x1 + md * y + mty;
    const cx = ma * x1 + mc * y1 + mtx, cy = mb * x1 + md * y1 + mty;
    const dx = ma * x + mc * y1 + mtx,  dy = mb * x + md * y1 + mty;
    i = this.writeVertex(i, ax, ay, r, g, b, a, WHITE_U, WHITE_V, 1, P);
    i = this.writeVertex(i, bx, by, r, g, b, a, WHITE_U, WHITE_V, 1, P);
    i = this.writeVertex(i, cx, cy, r, g, b, a, WHITE_U, WHITE_V, 1, P);
    this.writeVertex(i, dx, dy, r, g, b, a, WHITE_U, WHITE_V, 1, P);
    this.pushQuadIndices();
    return this.fitQuad(this.nVerts - 4, this.nIdx - 6);
  }

  /**
   * Append one image quad: the destination rect `(x, y, w, h)` mapped through
   * `m`, sampling `(u0, v0)`-`(u1, v1)`, every corner carrying `post` as the
   * after-the-color-matrix alpha factor and `rgb` as the scale on its texel.
   * `slot` is the texture unit the corners sample, and may carry the index of
   * the run's matrix they are mapped by as well (`withMatrix`).
   *
   * Corners wind top-left, top-right, bottom-right, bottom-left — the same
   * winding `pushRect` uses, which is what lets a run of mixed rects and quads
   * keep the canonical index pattern.
   */
  pushQuad(
    x: number, y: number, w: number, h: number, m: GlMat3,
    u0: number, v0: number, u1: number, v1: number,
    post: number, slot: number, r = 1, g = 1, b = 1,
  ): boolean {
    this.reserve(4, 6);
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const ax = ma * x + mc * y + mtx,   ay = mb * x + md * y + mty;
    const bx = ma * x1 + mc * y + mtx,  by = mb * x1 + md * y + mty;
    const cx = ma * x1 + mc * y1 + mtx, cy = mb * x1 + md * y1 + mty;
    const dx = ma * x + mc * y1 + mtx,  dy = mb * x + md * y1 + mty;
    const P = packSlot(slot, PAINT_MODE_IMAGE);
    i = this.writeVertex(i, ax, ay, r, g, b, 1, u0, v0, post, P);
    i = this.writeVertex(i, bx, by, r, g, b, 1, u1, v0, post, P);
    i = this.writeVertex(i, cx, cy, r, g, b, 1, u1, v1, post, P);
    this.writeVertex(i, dx, dy, r, g, b, 1, u0, v1, post, P);
    this.pushQuadIndices();
    return this.fitQuad(this.nVerts - 4, this.nIdx - 6);
  }

  /**
   * Append the glyph quad at `at` in `quads` (a group's `quadData`) moved by `(ox, oy)` and mapped
   * through `m`, sampling the font atlas at `slot`, painted in `rgba`. Arrays, not numbers: each
   * fractional number passed to a call not inlined is a heap allocation.
   *
   * `mode` says which channels of that atlas carry the distance field, and
   * rides the vertices packed into the slot. `synthBold` is the shift on the
   * field's threshold, in `a_post`: a glyph has no use for an alpha factor there.
   *
   * A synthetic oblique is sheared and the glyph's turn applied here, before
   * `m` (`placeGlyph`); `tanItalic` is 0 for an upright face. `grow` is the
   * screen distance the quad grows by for area coverage, and a grown quad's corners ride `a_post`
   * too (`shaders/glyphCell.ts`), so a clip that crosses one refuses it rather than interpolating
   * them into the wrong corner. Corners wind as `pushQuad`'s do.
   */
  pushGlyph(
    quads: ArrayLike<number>, at: number, ox: number, oy: number, tanItalic: number, m: GlMat3,
    rgba: ArrayLike<number>, slot: number, mode: number, synthBold: number, grow = 0,
  ): boolean {
    this.reserve(4, 6);
    let i = this.nVerts * FLOATS_PER_VERTEX;
    placeGlyph(quads, at, ox, oy, tanItalic, m, grow, PLACED);
    const c = PLACED.xy, t = PLACED.uv;
    const r = rgba[0], g = rgba[1], b = rgba[2], a = rgba[3];
    const P = packSlot(slot, mode);
    const k = grow > 0 ? GLYPH_CORNER_POST : NO_CORNERS;
    i = this.writeVertex(i, c[0], c[1], r, g, b, a, t[0], t[1], synthBold + k[0], P);
    i = this.writeVertex(i, c[2], c[3], r, g, b, a, t[2], t[1], synthBold + k[1], P);
    i = this.writeVertex(i, c[4], c[5], r, g, b, a, t[2], t[3], synthBold + k[2], P);
    this.writeVertex(i, c[6], c[7], r, g, b, a, t[0], t[3], synthBold + k[3], P);
    this.pushQuadIndices();
    return this.fitQuad(this.nVerts - 4, this.nIdx - 6, grow <= 0);
  }

  /**
   * Append one rect filled by a gradient: the corners of `(x, y, w, h)` mapped
   * through `m`, sampling the ramp atlas at `slot`.
   *
   * `uv` gives each channel of `a_uv` as an affine function of the coordinates
   * the corners arrive in. `mode` says whether that is a ramp position or a
   * gradient-space coordinate, and `post` carries the atlas row for the modes
   * that read it — see `shaders/batchFill.ts`. Values outside 0..1 clamp to
   * the atlas's edge texel.
   */
  pushGradientRect(
    x: number, y: number, w: number, h: number, m: GlMat3,
    uv: GradientUV, post: number, slot: number, mode: number,
    r: number, g: number, b: number, a: number,
  ): boolean {
    this.reserve(4, 6);
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const x1 = x + w;
    const y1 = y + h;
    const P = packSlot(slot, mode);
    const corner = (cx: number, cy: number): number => {
      const at = i;
      i = this.writeVertex(
        at, ma * cx + mc * cy + mtx, mb * cx + md * cy + mty,
        r, g, b, a,
        uv.ux * cx + uv.uy * cy + uv.u0,
        uv.vx * cx + uv.vy * cy + uv.v0,
        post, P,
      );
      return i;
    };
    corner(x, y);
    corner(x1, y);
    corner(x1, y1);
    corner(x, y1);
    this.pushQuadIndices();
    return this.fitQuad(this.nVerts - 4, this.nIdx - 6);
  }

  /** `pushMesh` for a mesh filled by a gradient — see `pushGradientRect` for
   *  what `uv`, `post` and `mode` carry. `colors`, four per vertex, scale
   *  `rgba` vertex by vertex where given. */
  pushGradientMesh(
    mesh: Mesh, m: GlMat3,
    uv: GradientUV, post: number, slot: number, mode: number,
    r: number, g: number, b: number, a: number, colors?: ArrayLike<number>,
  ): boolean {
    const src = mesh.vertices;
    const srcIdx = mesh.indices;
    const n = src.length >> 1;
    this.reserve(n, srcIdx.length);
    this.pureRects = false;
    const v = this.verts;
    let i = this.nVerts * FLOATS_PER_VERTEX;
    const ma = m[0], mb = m[1], mc = m[3], md = m[4], mtx = m[6], mty = m[7];
    const P = packSlot(slot, mode);
    const ox = mesh.origin?.x ?? 0, oy = mesh.origin?.y ?? 0;
    for (let k = 0; k < n; k++) {
      const x = src[k * 2] + ox, y = src[k * 2 + 1] + oy;
      v[i++] = ma * x + mc * y + mtx;
      v[i++] = mb * x + md * y + mty;
      if (colors === undefined) {
        v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
      } else {
        const c = k * 4;
        v[i++] = r * colors[c]; v[i++] = g * colors[c + 1]; v[i++] = b * colors[c + 2]; v[i++] = a * colors[c + 3];
      }
      v[i++] = uv.ux * x + uv.uy * y + uv.u0;
      v[i++] = uv.vx * x + uv.vy * y + uv.v0;
      v[i++] = post; v[i++] = P;
    }
    const base = this.nVerts;
    const out = this.idx;
    let j = this.nIdx;
    for (let k = 0; k < srcIdx.length; k++) out[j++] = base + srcIdx[k];
    this.nVerts += n;
    this.nIdx += srcIdx.length;
    return this.fitMesh(base, this.nIdx - srcIdx.length);
  }

  /**
   * Append a tessellated mesh through `m`, all vertices carrying `rgba` and
   * `P`, as `pushRect`'s do, or `rgba` scaled by their own four of `colors`.
   * The mesh's own indices are rebased onto the staged vertices, which is why
   * the index buffer is uploaded per flush.
   */
  pushMesh(
    mesh: Mesh, m: GlMat3,
    r: number, g: number, b: number, a: number, P: number, colors?: ArrayLike<number>,
  ): boolean {
    return this.pushGradientMesh(mesh, m, SOLID_UV, 1, P, PAINT_MODE_PLAIN, r, g, b, a, colors);
  }

  /** Upload the staged geometry into the next set of buffers, and return the
   *  geometry a draw of it names and its index count. */
  upload(): { geometry: GpuGeometry; count: number } {
    return this.buffers.upload(this.verts, this.nVerts, this.idx, this.nIdx, this.pureRects);
  }

  reset(): void {
    this.nVerts = 0;
    this.nIdx = 0;
    this.pureRects = true;
  }

  dispose(): void {
    this.buffers.dispose();
  }
}

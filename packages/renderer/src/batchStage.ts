/**
 * The CPU side of a run: the staged vertex and index arrays, and cutting what
 * is staged to the run's clip (`batchClip.ts`). `DrawBatch` adds the GL
 * buffers and the push methods on top.
 */

import { cutConvexPolygon, cutKeeps, cutMisses, type BatchCut } from './batchClip';

/** vec2 a_position + vec4 a_vertexColor + vec2 a_uv + float a_post + float
 *  a_texSlot. */
export const FLOATS_PER_VERTEX = 10;

const F = FLOATS_PER_VERTEX;
const INITIAL_VERTICES = 256;
const INITIAL_INDICES = 384;
/** Corners a cut polygon can reach: a quad, a rect's four edges, and every
 *  plane a cut holds (`MAX_CUT_PLANES`). */
const POLY_CORNERS = 32;

export function doubledTo(from: number, need: number): number {
  let capacity = from;
  while (capacity < need) capacity *= 2;
  return capacity;
}

export abstract class BatchStage {
  protected verts = new Float32Array(INITIAL_VERTICES * F);
  protected idx = new Uint32Array(INITIAL_INDICES);
  protected nVerts = 0;
  protected nIdx = 0;
  /** Whether the staged run is quads alone, so its indices are the canonical
   *  pattern and a slot already holding that pattern needs no upload. */
  protected pureRects = true;

  /** What every push is cut to, or `null`. A push returns `false`, having
   *  staged nothing, for geometry it may not cut; see `fitQuad`. */
  clip: BatchCut | null = null;
  private readonly polyIn = new Float32Array(POLY_CORNERS * F);
  private readonly polyOut = new Float32Array(POLY_CORNERS * F);
  private readonly polyTmp = new Float32Array(POLY_CORNERS * F);
  private triangles = new Uint32Array(0);

  protected writeVertex(
    i: number,
    x: number, y: number,
    r: number, g: number, b: number, a: number,
    u: number, v: number, post: number, packed: number,
  ): number {
    const out = this.verts;
    out[i] = x; out[i + 1] = y;
    out[i + 2] = r; out[i + 3] = g; out[i + 4] = b; out[i + 5] = a;
    out[i + 6] = u; out[i + 7] = v; out[i + 8] = post; out[i + 9] = packed;
    return i + F;
  }

  /** Two triangles over the four corners just written. */
  protected pushQuadIndices(): void {
    const base = this.nVerts;
    let j = this.nIdx;
    this.idx[j++] = base;     this.idx[j++] = base + 1; this.idx[j++] = base + 2;
    this.idx[j++] = base;     this.idx[j++] = base + 2; this.idx[j++] = base + 3;
    this.nVerts += 4;
    this.nIdx += 6;
  }

  /** Grow the CPU arrays so `vertices` / `indices` more fit. */
  protected reserve(vertices: number, indices: number): void {
    const needVerts = (this.nVerts + vertices) * F;
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

  /**
   * Fit the quad just written at `v0` to the clip: keep it if it lies inside,
   * drop it if it misses, and cut it if it crosses. A crossing that would cut
   * a slanted edge, the quad's or a clip's, is cut only where the clip says so
   * (`BatchCut.slanted`, and `batchClip.ts` for why); otherwise the quad is
   * rolled back and refused, for the caller to clip another way
   * (`enterUncut`).
   */
  protected fitQuad(v0: number, i0: number): boolean {
    const cut = this.clip;
    if (cut === null) return true;
    const v = this.verts;
    const at = v0 * F;
    if (cutKeeps(cut, v[at], v[at + 1]) && cutKeeps(cut, v[at + F], v[at + F + 1])
        && cutKeeps(cut, v[at + 2 * F], v[at + 2 * F + 1]) && cutKeeps(cut, v[at + 3 * F], v[at + 3 * F + 1])) {
      return true;
    }
    this.nVerts = v0;
    this.nIdx = i0;
    if (cutMisses(cut, v, at, 4, F)) return true;
    if (!cut.slanted) {
      const ax = v[at], ay = v[at + 1], bx = v[at + F], by = v[at + F + 1];
      const cx = v[at + 2 * F], cy = v[at + 2 * F + 1], dx = v[at + 3 * F], dy = v[at + 3 * F + 1];
      const alongAxes = (ay === by && bx === cx && cy === dy && dx === ax)
        || (ax === bx && by === cy && cx === dx && dy === ay);
      if (!alongAxes || cut.planes.length > 0) return false;
    }
    this.polyIn.set(v.subarray(at, at + 4 * F));
    this.appendFan(cutConvexPolygon(this.polyIn, 4, F, cut, this.polyOut, this.polyTmp));
    return true;
  }

  /**
   * `fitQuad` for a mesh staged from `v0`, its indices from `i0`. A mesh's
   * edges are slanted in general, so one that crosses is refused unless the
   * clip takes slanted cuts; then each triangle across it is cut alone.
   */
  protected fitMesh(v0: number, i0: number): boolean {
    const cut = this.clip;
    if (cut === null) return true;
    const v = this.verts;
    let inside = true;
    for (let i = v0 * F; i < this.nVerts * F && inside; i += F) inside = cutKeeps(cut, v[i], v[i + 1]);
    if (inside) return true;
    const end = this.nIdx;
    const missed = cutMisses(cut, v, v0 * F, this.nVerts - v0, F);
    if (missed || !cut.slanted) {
      this.nVerts = v0;
      this.nIdx = i0;
      return missed;
    }
    if (this.triangles.length < end - i0) this.triangles = new Uint32Array(doubledTo(64, end - i0));
    const tri = this.triangles;
    tri.set(this.idx.subarray(i0, end));
    this.nIdx = i0;
    for (let t = 0; t < end - i0; t += 3) this.fitTriangle(cut, tri[t], tri[t + 1], tri[t + 2]);
    return true;
  }

  private fitTriangle(cut: BatchCut, a: number, b: number, c: number): void {
    const v = this.verts;
    if (cutKeeps(cut, v[a * F], v[a * F + 1]) && cutKeeps(cut, v[b * F], v[b * F + 1])
        && cutKeeps(cut, v[c * F], v[c * F + 1])) {
      this.reserve(0, 3);
      this.idx[this.nIdx++] = a; this.idx[this.nIdx++] = b; this.idx[this.nIdx++] = c;
      return;
    }
    const poly = this.polyIn;
    poly.set(v.subarray(a * F, a * F + F), 0);
    poly.set(v.subarray(b * F, b * F + F), F);
    poly.set(v.subarray(c * F, c * F + F), 2 * F);
    if (cutMisses(cut, poly, 0, 3, F)) return;
    this.appendFan(cutConvexPolygon(poly, 3, F, cut, this.polyOut, this.polyTmp));
  }

  /** Append the `n`-corner convex polygon in `polyOut` as a triangle fan. */
  private appendFan(n: number): void {
    if (n < 3) return;
    this.reserve(n, (n - 2) * 3);
    if (n !== 4) this.pureRects = false;
    const base = this.nVerts;
    this.verts.set(this.polyOut.subarray(0, n * F), base * F);
    let j = this.nIdx;
    for (let k = 1; k < n - 1; k++) {
      this.idx[j++] = base; this.idx[j++] = base + k; this.idx[j++] = base + k + 1;
    }
    this.nVerts += n;
    this.nIdx = j;
  }
}

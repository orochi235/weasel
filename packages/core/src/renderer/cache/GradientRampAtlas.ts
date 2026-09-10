/**
 * CPU gradient-ramp builder + the GL texture every baked ramp lives in.
 *
 * Each unique stop list is baked once into a 256-texel strip and written to its
 * own **row** of one RGBA texture, keyed by `JSON.stringify(stops)`. One
 * texture rather than one per ramp is what lets a gradient take a batch texture
 * slot the way a bitmap or a font atlas does: every gradient in a frame samples
 * the same unit, so a run does not break per gradient. The atlas is
 * GL-context-bound; discard and recreate on context loss.
 *
 * Output convention §2: texels are stored as straight RGBA. The fragment
 * shader applies premultiplication before writing outColor.
 */

import type { GradStop } from '@weasel-js/paint';
import { resolveGradientStops, sampleResolvedStops } from '../../core/gradient';

/** Texels across one ramp — the resolution a gradient is sampled at. */
export const RAMP_WIDTH = 256;

/** Rows the atlas starts at, doubling from there. */
const INITIAL_ROWS = 16;

/**
 * Rows the atlas stops growing at, past which the least recently used row is
 * recycled.
 *
 * WebGL2 guarantees `MAX_TEXTURE_SIZE` of at least 2048, so this is available
 * everywhere without a `getParameter` — which the GL recorder would answer with
 * a recording function rather than a number. A cap is also what bounds an
 * animating gradient, which mints a new stop list every frame and would
 * otherwise grow the atlas until it could not grow again.
 */
export const RAMP_ATLAS_MAX_ROWS = 1024;

/** Bake gradient stops into a 256-entry RGBA lookup strip, which the shader
 *  samples instead of evaluating stops per fragment. */
export function buildGradientRamp(stops: GradStop[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(RAMP_WIDTH * 4);
  if (stops.length === 0) return data;

  const resolved = resolveGradientStops(stops);
  for (let i = 0; i < RAMP_WIDTH; i++) {
    const [r, g, b, a] = sampleResolvedStops(resolved, i / (RAMP_WIDTH - 1));
    data[i * 4]     = r * 255;
    data[i * 4 + 1] = g * 255;
    data[i * 4 + 2] = b * 255;
    data[i * 4 + 3] = a * 255;
  }

  return data;
}

export class GradientRampAtlas {
  /** Row per stop list, in least-recently-used order: a hit re-inserts, so the
   *  first entry is the row a full atlas recycles. */
  private readonly rowByKey = new Map<string, number>();
  private texture: WebGLTexture | null = null;
  private rows = 0;
  /** Mirror of the texture, so growth can respecify it without re-baking every
   *  ramp it already holds. */
  private pixels = new Uint8ClampedArray(0);
  private totalQueries = 0;
  private cacheHits = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  /** Rows the atlas currently holds — its texture height. */
  get height(): number {
    return this.rows;
  }

  /**
   * Bake `stops` into a row and return it, reusing the row an identical stop
   * list already holds.
   *
   * **A returned row outlives the frame only while the atlas has room.** Past
   * `RAMP_ATLAS_MAX_ROWS` an upload recycles the least recently used row, which
   * rewrites texels a row handed out earlier still names. Nothing that defers
   * its draw past this call may hold a row across another `upload` without
   * arranging to be flushed first.
   */
  upload(stops: GradStop[]): number {
    const key = JSON.stringify(stops);
    this.totalQueries++;
    const existing = this.rowByKey.get(key);
    if (existing !== undefined) {
      this.cacheHits++;
      this.rowByKey.delete(key);
      this.rowByKey.set(key, existing);
      return existing;
    }

    const row = this.claimRow();
    this.writeRow(row, buildGradientRamp(stops));
    this.rowByKey.set(key, row);
    return row;
  }

  /**
   * Whether uploading `stops` would move where existing rows sit — by growing
   * the atlas, which changes every row's `v`, or by recycling one, which
   * rewrites its texels.
   *
   * Anything holding a row past this call asks first and gets itself out of
   * the way, because neither can be undone once it has happened.
   */
  wouldReshape(stops: GradStop[]): boolean {
    // An atlas holding nothing has no row to move, so its first growth is free.
    if (this.rowByKey.size === 0) return false;
    return !this.rowByKey.has(JSON.stringify(stops))
      && this.rowByKey.size >= this.rows;
  }

  /**
   * The `v` a row is sampled at — its center.
   *
   * The center is load-bearing: the atlas filters LINEAR, so a `v` anywhere
   * else blends the ramp beside it into this one. At the center the neighbor's
   * weight is exactly zero.
   */
  rowV(row: number): number {
    return (row + 0.5) / (this.rows || 1);
  }

  bind(unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  hitRate(): number {
    if (this.totalQueries === 0) return 0;
    return this.cacheHits / this.totalQueries;
  }

  resetStats(): void {
    this.totalQueries = 0;
    this.cacheHits = 0;
  }

  /**
   * Delete the atlas texture and forget every row in it. Called by
   * `WeaselRenderer.dispose()`. The CPU mirror goes with it, so the atlas is
   * unusable but refillable afterward (stats are left as-is; call
   * `resetStats()` separately if desired).
   */
  free(): void {
    if (this.texture) this.gl.deleteTexture(this.texture);
    this.texture = null;
    this.rows = 0;
    this.pixels = new Uint8ClampedArray(0);
    this.rowByKey.clear();
  }

  /** The row the next ramp is written to: a free one, a taller atlas, or the
   *  least recently used row of a full one. */
  private claimRow(): number {
    if (this.rowByKey.size < this.rows) return this.rowByKey.size;
    if (this.rows < RAMP_ATLAS_MAX_ROWS) {
      this.resize(this.rows === 0 ? INITIAL_ROWS : this.rows * 2);
      return this.rowByKey.size;
    }
    const [lruKey, lruRow] = this.rowByKey.entries().next().value as [string, number];
    this.rowByKey.delete(lruKey);
    return lruRow;
  }

  /** Grow to `rows`, keeping every row at the index it already had — a row
   *  index is a stable name, and callers hold them. */
  private resize(rows: number): void {
    const gl = this.gl;
    const next = new Uint8ClampedArray(RAMP_WIDTH * rows * 4);
    next.set(this.pixels);
    this.pixels = next;
    this.rows = rows;

    if (!this.texture) {
      const tex = gl.createTexture();
      if (!tex) throw new Error('GradientRampAtlas: createTexture failed');
      this.texture = tex;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      RAMP_WIDTH, rows, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, this.pixels,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private writeRow(row: number, ramp: Uint8ClampedArray): void {
    const gl = this.gl;
    this.pixels.set(ramp, row * RAMP_WIDTH * 4);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, row,
      RAMP_WIDTH, 1,
      gl.RGBA, gl.UNSIGNED_BYTE, ramp,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

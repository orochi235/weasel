/**
 * CPU gradient-ramp builder + GL 1×256 RGBA texture cache.
 *
 * Each unique stop list is uploaded once. Key = JSON.stringify(stops).
 * The cache is GL-context-bound; discard and recreate on context loss.
 *
 * Output convention §2: texels are stored as straight RGBA. The fragment
 * shader applies premultiplication before writing outColor.
 */

import type { GradStop } from '@weasel-js/core';
import { resolveColor } from '../math/color';

const RAMP_SIZE = 256;

/** Bake gradient stops into a 256-entry RGBA lookup strip, which the shader
 *  samples instead of evaluating stops per fragment. */
export function buildGradientRamp(stops: GradStop[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(RAMP_SIZE * 4);
  if (stops.length === 0) return data;

  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const parsed: [number, number, number, number][] = sorted.map((s) => {
    const [r, g, b, a] = resolveColor(s.color);
    return [r * 255, g * 255, b * 255, a * 255];
  });

  for (let i = 0; i < RAMP_SIZE; i++) {
    const t = i / (RAMP_SIZE - 1);
    let lo = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (t >= sorted[j].offset) lo = j;
    }
    const hi = Math.min(lo + 1, sorted.length - 1);

    let r: number, g: number, b: number, a: number;
    if (lo === hi) {
      [r, g, b, a] = parsed[lo];
    } else {
      const span = sorted[hi].offset - sorted[lo].offset;
      const frac = span > 0 ? (t - sorted[lo].offset) / span : 0;
      const [r0, g0, b0, a0] = parsed[lo];
      const [r1, g1, b1, a1] = parsed[hi];
      r = r0 + (r1 - r0) * frac;
      g = g0 + (g1 - g0) * frac;
      b = b0 + (b1 - b0) * frac;
      a = a0 + (a1 - a0) * frac;
    }

    data[i * 4]     = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }

  return data;
}

export class GradientRampCache {
  private readonly map = new Map<string, WebGLTexture>();
  private totalQueries = 0;
  private cacheHits = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  upload(stops: GradStop[]): string {
    const key = JSON.stringify(stops);
    this.totalQueries++;
    if (this.map.has(key)) {
      this.cacheHits++;
      return key;
    }

    const ramp = buildGradientRamp(stops);
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('GradientRampCache: createTexture failed');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      RAMP_SIZE, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, ramp,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(key, tex);
    return key;
  }

  bind(key: string, unit: number): void {
    const tex = this.map.get(key);
    if (!tex) throw new Error(`GradientRampCache: key "${key}" not uploaded`);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
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
   * Delete every uploaded GL ramp texture and clear the map. Called by
   * `WeaselRenderer.dispose()`. Only the GL textures are owned resources —
   * `buildGradientRamp`'s CPU-side `Uint8ClampedArray` is transient per
   * `upload()` call and already gone by the time a ramp is cached. The
   * cache is unusable but refillable afterward (stats are left as-is; call
   * `resetStats()` separately if desired).
   */
  free(): void {
    const gl = this.gl;
    for (const tex of this.map.values()) {
      gl.deleteTexture(tex);
    }
    this.map.clear();
  }
}

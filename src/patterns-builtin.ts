/**
 * Built-in pattern factories — generic line/dot/scatter textures. Each
 * returns a `CanvasPattern` you can wrap in a `Paint` of
 * `{ kind: 'pattern', pattern }` and pass to anything that accepts a `Paint`
 * (`renderFilledRegion`, `applyPaint`, layer factories' `fill` options).
 * Imported from a subpath so consumers that ship their own catalog can
 * avoid the bundle cost.
 *
 * All factories require an explicit `color` (and `bg` for `chunks`). No
 * defaults are baked in — the caller's design system is the source of truth
 * for palette decisions.
 */

import { createTilePattern } from './patterns';

/** Diagonal hatch (forward slash). */
export interface HatchParams {
  color: string;
  size?: number;
  lineWidth?: number;
}

export function hatch(
  ctx: CanvasRenderingContext2D,
  params: HatchParams,
): CanvasPattern | null {
  const { color, size = 5, lineWidth = 1 } = params;
  return createTilePattern(ctx, {
    size,
    draw: (oc, s) => {
      oc.strokeStyle = color;
      oc.lineWidth = lineWidth;
      oc.beginPath();
      oc.moveTo(-1, s + 1);
      oc.lineTo(s + 1, -1);
      oc.moveTo(-1, 1);
      oc.lineTo(1, -1);
      oc.moveTo(s - 1, s + 1);
      oc.lineTo(s + 1, s - 1);
      oc.stroke();
    },
  });
}

/** Diagonal hatch in both directions. */
export interface CrosshatchParams {
  color: string;
  size?: number;
  lineWidth?: number;
}

export function crosshatch(
  ctx: CanvasRenderingContext2D,
  params: CrosshatchParams,
): CanvasPattern | null {
  const { color, size = 6, lineWidth = 0.8 } = params;
  return createTilePattern(ctx, {
    size,
    draw: (oc, s) => {
      oc.strokeStyle = color;
      oc.lineWidth = lineWidth;
      oc.beginPath();
      // Forward diagonal (with seamless tiling).
      oc.moveTo(-1, s + 1);
      oc.lineTo(s + 1, -1);
      oc.moveTo(-1, 1);
      oc.lineTo(1, -1);
      oc.moveTo(s - 1, s + 1);
      oc.lineTo(s + 1, s - 1);
      // Backward diagonal.
      oc.moveTo(-1, -1);
      oc.lineTo(s + 1, s + 1);
      oc.moveTo(s - 1, -1);
      oc.lineTo(s + 1, 1);
      oc.moveTo(-1, s - 1);
      oc.lineTo(1, s + 1);
      oc.stroke();
    },
  });
}

/** Regular grid of filled dots. */
export interface DotsParams {
  color: string;
  size?: number;
  radius?: number;
}

export function dots(
  ctx: CanvasRenderingContext2D,
  params: DotsParams,
): CanvasPattern | null {
  const { color, size = 6, radius = 1 } = params;
  return createTilePattern(ctx, {
    size,
    draw: (oc, s) => {
      oc.fillStyle = color;
      oc.beginPath();
      oc.arc(s / 2, s / 2, radius, 0, Math.PI * 2);
      oc.fill();
    },
  });
}

/**
 * Random scatter of small ellipses on top of a solid background. Driven by a
 * seeded PRNG so the same `seed` produces a deterministic tile.
 *
 * Note: the `bg` field is optional — omit it for a transparent background
 * (the scatter shapes draw directly onto whatever sits beneath the overlay).
 */
export interface ChunksParams {
  color: string;
  bg?: string;
  size?: number;
  /** Coverage: `chunks * chunkSize²` per `size²` tile. Range ~[0, 1]. */
  density?: number;
  chunkSize?: number;
  seed?: number;
}

/** Simple seeded PRNG (mulberry32) for deterministic chunk placement. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function chunks(
  ctx: CanvasRenderingContext2D,
  params: ChunksParams,
): CanvasPattern | null {
  const { color, bg, size = 48, density = 0.35, chunkSize = 3, seed = 42 } = params;
  return createTilePattern(ctx, {
    size,
    draw: (oc, s) => {
      if (bg !== undefined) {
        oc.fillStyle = bg;
        oc.fillRect(0, 0, s, s);
      }
      const rand = mulberry32(seed);
      const count = Math.round((s * s * density) / (chunkSize * chunkSize));
      oc.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const cx = rand() * s;
        const cy = rand() * s;
        const w = chunkSize * (0.5 + rand());
        const h = chunkSize * (0.5 + rand());
        const angle = rand() * Math.PI;
        oc.save();
        oc.translate(cx, cy);
        oc.rotate(angle);
        oc.beginPath();
        oc.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        oc.fill();
        oc.restore();
      }
    },
  });
}

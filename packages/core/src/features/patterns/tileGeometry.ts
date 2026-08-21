/**
 * The shapes a built-in tile is made of, as data.
 *
 * One description, two renderers: `patterns-builtin` strokes/fills these to
 * an `OffscreenCanvas` to build the GL texture, and `@weasel-js/svg` maps
 * them to `<pattern>` children. Duplicating the tile drawing in the
 * serializer would let the raster and vector forms drift apart silently.
 */

import type { TilePatternSpec } from '../../core/paint-types';

/** One primitive within a pattern tile, in tile-local coordinates. */
export type TileShape =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; color: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotation: number; color: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color: string };

/** A built-in tile's shapes plus the edge length they're drawn within. */
export interface TileGeometry {
  size: number;
  shapes: TileShape[];
}

/** Defaults per tile kind, matching each factory's signature. */
export function tileSize(spec: TilePatternSpec): number {
  if (spec.size !== undefined) return spec.size;
  switch (spec.tile) {
    case 'hatch': return 5;
    case 'crosshatch': return 6;
    case 'dots': return 6;
    case 'chunks': return 48;
    default: return 8;
  }
}

/** Seeded PRNG (mulberry32) — `chunks` places its scatter with this, so the
 *  same `seed` yields the same tile in both the raster and vector paths. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resolve a pattern spec to the shapes that make up one tile. Consumers that
 *  want to draw a pattern swatch themselves — a picker, an SVG export — read
 *  this rather than rasterizing a texture. */
export function tileGeometry(spec: TilePatternSpec): TileGeometry {
  const s = tileSize(spec);
  const { color } = spec;

  switch (spec.tile) {
    case 'hatch': {
      const width = spec.lineWidth ?? 1;
      return { size: s, shapes: forwardDiagonals(s, width, color) };
    }
    case 'crosshatch': {
      const width = spec.lineWidth ?? 0.8;
      return {
        size: s,
        shapes: [...forwardDiagonals(s, width, color), ...backwardDiagonals(s, width, color)],
      };
    }
    case 'dots': {
      const r = spec.radius ?? 1;
      return { size: s, shapes: [{ kind: 'circle', cx: s / 2, cy: s / 2, r, color }] };
    }
    case 'chunks': {
      const density = spec.density ?? 0.35;
      const chunkSize = spec.chunkSize ?? 3;
      const rand = mulberry32(spec.seed ?? 42);
      const count = Math.round((s * s * density) / (chunkSize * chunkSize));
      const shapes: TileShape[] = [];
      if (spec.bg !== undefined) {
        shapes.push({ kind: 'rect', x: 0, y: 0, width: s, height: s, color: spec.bg });
      }
      for (let i = 0; i < count; i++) {
        const cx = rand() * s;
        const cy = rand() * s;
        const w = chunkSize * (0.5 + rand());
        const h = chunkSize * (0.5 + rand());
        const rotation = rand() * Math.PI;
        shapes.push({ kind: 'ellipse', cx, cy, rx: w / 2, ry: h / 2, rotation, color });
      }
      return { size: s, shapes };
    }
    default:
      return { size: s, shapes: [] };
  }
}

/** The forward (`/`) diagonal, plus the two corner stubs that make it tile
 *  seamlessly across the edges. */
function forwardDiagonals(s: number, width: number, color: string): TileShape[] {
  return [
    { kind: 'line', x1: -1, y1: s + 1, x2: s + 1, y2: -1, width, color },
    { kind: 'line', x1: -1, y1: 1, x2: 1, y2: -1, width, color },
    { kind: 'line', x1: s - 1, y1: s + 1, x2: s + 1, y2: s - 1, width, color },
  ];
}

/** The backward (`\`) diagonal and its two stubs. */
function backwardDiagonals(s: number, width: number, color: string): TileShape[] {
  return [
    { kind: 'line', x1: -1, y1: -1, x2: s + 1, y2: s + 1, width, color },
    { kind: 'line', x1: s - 1, y1: -1, x2: s + 1, y2: 1, width, color },
    { kind: 'line', x1: -1, y1: s - 1, x2: 1, y2: s + 1, width, color },
  ];
}

/** Draw a tile's shapes to a 2D context — the raster half of the pair. */
export function drawTileShapes(oc: CanvasRenderingContext2D, geometry: TileGeometry): void {
  for (const shape of geometry.shapes) {
    if (shape.kind === 'line') {
      oc.strokeStyle = shape.color;
      oc.lineWidth = shape.width;
      oc.beginPath();
      oc.moveTo(shape.x1, shape.y1);
      oc.lineTo(shape.x2, shape.y2);
      oc.stroke();
      continue;
    }
    oc.fillStyle = shape.color;
    if (shape.kind === 'rect') {
      oc.fillRect(shape.x, shape.y, shape.width, shape.height);
      continue;
    }
    oc.beginPath();
    if (shape.kind === 'circle') {
      oc.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
    } else {
      oc.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, shape.rotation, 0, Math.PI * 2);
    }
    oc.fill();
  }
}

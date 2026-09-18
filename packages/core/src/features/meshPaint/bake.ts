/**
 * A mesh paint baked into one RGBA bitmap.
 *
 * A patch is a surface over `(u, v)`, but a paint has to answer "what color is
 * this fragment", which is the inverse question — and inverting a bicubic is
 * Newton iteration per fragment. Every renderer that draws these instead
 * subdivides the patch into small quads and rasterizes them forward, which is
 * what this does, once per paint, into a texture the shader then samples. The
 * cost is a texture and a resolution; the gain is that the paint composes with
 * every fill the renderer already knows how to draw, clipping included.
 *
 * The bitmap is straight (non-premultiplied) RGBA, matching the ramp atlas;
 * the fragment shader premultiplies.
 */

import { resolveColor } from '../../renderer/math/color';
import { lerpColorArray, type ColorSpace } from '@weasel-js/paint';
import { evalPatch, isValidPatch, patchBounds, type MeshPatch } from './surface';

/** Texels on a side of a baked mesh. A mesh gradient is smooth by
 *  construction, so this is about how large it is drawn, not how detailed it
 *  is; 256 covers a paint at typical shape sizes without a visible step. */
export const MESH_BAKE_SIZE = 256;

/** Quads per patch on a side. The rasterizer interpolates color linearly
 *  inside a cell, so this is what keeps a perceptual blend perceptual: at 24
 *  a cell spans ~10 texels of the bake. */
const GRID = 24;

/** The box a bake covers, in the paint's own space. */
export interface MeshBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BakedMesh {
  /** `MESH_BAKE_SIZE` square, straight RGBA. */
  pixels: Uint8ClampedArray;
  size: number;
  /** Where the bitmap sits in paint space, which is what the shader maps a
   *  fragment through. */
  box: MeshBox;
}

/** The union of every patch's bounds, or `null` when nothing is drawable. */
export function meshBounds(patches: readonly MeshPatch[]): MeshBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const patch of patches) {
    if (!isValidPatch(patch)) continue;
    const b = patchBounds(patch);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

type Rgba = readonly [number, number, number, number];

/**
 * Corner colors blended at `(u, v)` in `space`.
 *
 * Bilinear as three lerps rather than four weights, because a perceptual space
 * has a midpoint between two colors and no meaningful four-way mix — OKLCh's
 * hue in particular is an arc, which only two endpoints define.
 */
function colorAt(corners: Rgba[], u: number, v: number, space: ColorSpace): number[] {
  const bottom = lerpColorArray(corners[0], corners[1], u, space);
  const top = lerpColorArray(corners[3], corners[2], u, space);
  return lerpColorArray(bottom, top, v, space);
}

/**
 * Rasterize `patches` into a square bitmap covering their union.
 *
 * Returns `null` when no patch is drawable, which is the caller's cue to paint
 * nothing rather than a blank square.
 */
export function bakeMesh(
  patches: readonly MeshPatch[],
  space: ColorSpace = 'rgb',
  size: number = MESH_BAKE_SIZE,
): BakedMesh | null {
  const box = meshBounds(patches);
  if (!box) return null;

  const pixels = new Uint8ClampedArray(size * size * 4);
  // The box maps onto texel *centers*, not texel edges: a corner of the mesh
  // lands at the center of the corner texel, so the outermost row and column
  // are covered rather than half-missed by a rasterizer testing centers.
  const toTexel = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: ((p.x - box.x) / box.width) * (size - 1) + 0.5,
    y: ((p.y - box.y) / box.height) * (size - 1) + 0.5,
  });

  for (const patch of patches) {
    if (!isValidPatch(patch)) continue;
    const corners = patch.colors.map((c) => resolveColor(c)) as Rgba[];

    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const u0 = i / GRID;
        const u1 = (i + 1) / GRID;
        const v0 = j / GRID;
        const v1 = (j + 1) / GRID;
        const quad = [
          { at: toTexel(evalPatch(patch, u0, v0)), color: colorAt(corners, u0, v0, space) },
          { at: toTexel(evalPatch(patch, u1, v0)), color: colorAt(corners, u1, v0, space) },
          { at: toTexel(evalPatch(patch, u1, v1)), color: colorAt(corners, u1, v1, space) },
          { at: toTexel(evalPatch(patch, u0, v1)), color: colorAt(corners, u0, v1, space) },
        ];
        fillTriangle(pixels, size, quad[0], quad[1], quad[2]);
        fillTriangle(pixels, size, quad[0], quad[2], quad[3]);
      }
    }
  }

  return { pixels, size, box };
}

interface Vertex {
  at: { x: number; y: number };
  color: number[];
}

const EDGE_EPS = 1e-6;

/**
 * One triangle, barycentric, colors interpolated across it.
 *
 * Neighboring cells share an edge, so a pixel exactly on one is claimed by
 * both — harmless here because both carry the same color there, and cheaper
 * than a fill rule.
 */
function fillTriangle(
  pixels: Uint8ClampedArray, size: number, a: Vertex, b: Vertex, c: Vertex,
): void {
  const minX = Math.max(0, Math.floor(Math.min(a.at.x, b.at.x, c.at.x)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(a.at.x, b.at.x, c.at.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.at.y, b.at.y, c.at.y)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(a.at.y, b.at.y, c.at.y)));
  if (maxX < minX || maxY < minY) return;

  const area = (b.at.x - a.at.x) * (c.at.y - a.at.y) - (c.at.x - a.at.x) * (b.at.y - a.at.y);
  // A degenerate cell — a patch collapsed to a line — covers nothing.
  if (Math.abs(area) < 1e-9) return;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b.at.x - px) * (c.at.y - py) - (c.at.x - px) * (b.at.y - py)) / area;
      const w1 = ((c.at.x - px) * (a.at.y - py) - (a.at.x - px) * (c.at.y - py)) / area;
      const w2 = 1 - w0 - w1;
      // An edge texel's center sits exactly on the boundary, where rounding
      // can put it a hair outside; the epsilon is what keeps the border row
      // from dropping out.
      if (w0 < -EDGE_EPS || w1 < -EDGE_EPS || w2 < -EDGE_EPS) continue;
      const k = (y * size + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        pixels[k + ch] = (w0 * a.color[ch] + w1 * b.color[ch] + w2 * c.color[ch]) * 255;
      }
    }
  }
}

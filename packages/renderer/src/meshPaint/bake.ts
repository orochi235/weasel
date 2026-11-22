/**
 * A mesh paint baked into one RGBA bitmap: each patch is subdivided into small
 * quads and rasterized forward, once per paint, into a texture the shader then
 * samples. Inverting a bicubic per fragment would be Newton iteration.
 *
 * The bitmap is premultiplied RGBA; the fragment shader only scales it by
 * opacity.
 */

import { tryParseColor } from '@weasel-js/paint';
import { warnOnce } from '../warnOnce';
import { lerpColorArray, type ColorSpace } from '@weasel-js/paint';
import { evalPatch, isValidPatch, patchBounds, type MeshPatch } from './surface';
import type { Rect } from '@weasel-js/geom';

/** Texels on a side of a bake when the caller names no size. The renderer
 *  sizes each bake from how large the paint draws — see `meshBakeSize`. */
export const MESH_BAKE_SIZE = 256;

/** Texels a rasterized cell spans at most. The rasterizer interpolates color
 *  linearly inside a cell and draws a curved edge as its chord, so this is
 *  what keeps a perceptual blend perceptual and an edge curved at any size. */
const TEXELS_PER_CELL = 10;

/** Quads per patch on a side, never fewer than 24. */
function gridFor(size: number): number {
  return Math.max(24, Math.ceil(size / TEXELS_PER_CELL));
}

/** The box a bake covers, in the paint's own space. */
export type MeshRect = Rect;

/** The bitmap `bakeMesh` produces, and the paint-space box it covers. */
export interface BakedMesh {
  /** `size` × `size` texels, premultiplied RGBA, so a bilinear sample across a patch's edge keeps its color. */
  pixels: Uint8ClampedArray;
  /** Texels on a side; `MESH_BAKE_SIZE` unless the caller asked otherwise. */
  size: number;
  /** Where the bitmap sits in paint space, which is what the shader maps a
   *  fragment through. */
  box: MeshRect;
}

/** The union of every patch's bounds, or `null` when nothing is drawable. */
export function meshBounds(patches: readonly MeshPatch[]): MeshRect | null {
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
 * Corner colors blended at `(u, v)` in `space`. Three lerps rather than four
 * weights, because a perceptual space has no meaningful four-way mix — OKLCh's
 * hue is an arc, which only two endpoints define.
 */
function colorAt(corners: Rgba[], u: number, v: number, space: ColorSpace): number[] {
  const bottom = lerpColorArray(corners[0], corners[1], u, space);
  const top = lerpColorArray(corners[3], corners[2], u, space);
  return lerpColorArray(bottom, top, v, space);
}

/**
 * Rasterize `patches` into a square bitmap covering their union, or `null`
 * when no patch is drawable.
 */
export function bakeMesh(
  patches: readonly MeshPatch[],
  space: ColorSpace = 'rgb',
  size: number = MESH_BAKE_SIZE,
): BakedMesh | null {
  const box = meshBounds(patches);
  if (!box) return null;

  const pixels = new Uint8ClampedArray(size * size * 4);
  const layer: PatchLayer = { pixels: new Uint8ClampedArray(size * size * 4), claims: new Uint8Array(size * size) };
  const grid = gridFor(size);
  // The box maps onto texel *centers*, not texel edges: a corner of the mesh
  // lands at the center of the corner texel, so the outermost row and column
  // are covered rather than half-missed by a rasterizer testing centers.
  const toTexel = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: ((p.x - box.x) / box.width) * (size - 1) + 0.5,
    y: ((p.y - box.y) / box.height) * (size - 1) + 0.5,
  });

  for (const patch of patches) {
    if (!isValidPatch(patch)) continue;
    const corners = patch.colors.map((c) => tryParseColor(c));
    const unread = patch.colors.find((_, i) => corners[i] === null);
    if (unread !== undefined) {
      warnOnce(`mesh-color:${unread}`, `weasel: a mesh patch's color '${unread}' does not parse; the patch is not drawn`);
      continue;
    }
    const rgba = corners as Rgba[];

    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        const u0 = i / grid;
        const u1 = (i + 1) / grid;
        const v0 = j / grid;
        const v1 = (j + 1) / grid;
        const quad = [
          { at: toTexel(evalPatch(patch, u0, v0)), color: colorAt(rgba, u0, v0, space) },
          { at: toTexel(evalPatch(patch, u1, v0)), color: colorAt(rgba, u1, v0, space) },
          { at: toTexel(evalPatch(patch, u1, v1)), color: colorAt(rgba, u1, v1, space) },
          { at: toTexel(evalPatch(patch, u0, v1)), color: colorAt(rgba, u0, v1, space) },
        ];
        // Which of each triangle's edges, opposite its first, second and third vertex, lie on the patch's outline.
        fillTriangle(layer, size, quad[0], quad[1], quad[2], (i === grid - 1 ? 1 : 0) | (j === 0 ? 4 : 0));
        fillTriangle(layer, size, quad[0], quad[2], quad[3], (j === grid - 1 ? 1 : 0) | (i === 0 ? 2 : 0));
      }
    }
    const b = patchBounds(patch);
    const lo = toTexel({ x: b.x, y: b.y });
    const hi = toTexel({ x: b.x + b.width, y: b.y + b.height });
    composite(pixels, layer, size, {
      minX: Math.max(0, Math.floor(lo.x) - 1), minY: Math.max(0, Math.floor(lo.y) - 1),
      maxX: Math.min(size - 1, Math.ceil(hi.x) + 1), maxY: Math.min(size - 1, Math.ceil(hi.y) + 1),
    });
  }

  return { pixels, size, box };
}

/**
 * One patch rasterized on its own, so it can go over the patches before it.
 * `claims` is 0 where the patch has nothing, 1 inside it, and 2 on its
 * outline.
 */
interface PatchLayer {
  pixels: Uint8ClampedArray;
  claims: Uint8Array;
}

interface TexelRegion { minX: number; minY: number; maxX: number; maxY: number }

/**
 * `layer` over `pixels` inside `region`, source-over, then cleared. A texel on
 * the patch's outline replaces what is under it instead, so two translucent
 * patches sharing an edge leave no doubled seam there.
 */
function composite(pixels: Uint8ClampedArray, layer: PatchLayer, size: number, region: TexelRegion): void {
  for (let y = region.minY; y <= region.maxY; y++) {
    for (let x = region.minX; x <= region.maxX; x++) {
      const t = y * size + x;
      const claim = layer.claims[t];
      if (claim === 0) continue;
      const k = t * 4;
      const keep = claim === 2 ? 0 : 1 - layer.pixels[k + 3] / 255;
      for (let ch = 0; ch < 4; ch++) {
        pixels[k + ch] = layer.pixels[k + ch] + pixels[k + ch] * keep;
        layer.pixels[k + ch] = 0;
      }
      layer.claims[t] = 0;
    }
  }
}

interface Vertex {
  at: { x: number; y: number };
  color: number[];
}

const EDGE_EPS = 1e-6;

/**
 * One triangle, barycentric, colors interpolated across it. A pixel exactly on
 * an edge two cells share is claimed by both — harmless, because both carry
 * the same color there.
 */
function fillTriangle(
  layer: PatchLayer, size: number, a: Vertex, b: Vertex, c: Vertex, outline: number,
): void {
  const { pixels, claims } = layer;
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
      const t = y * size + x;
      const onOutline = ((outline & 1) && w0 <= EDGE_EPS) || ((outline & 2) && w1 <= EDGE_EPS) || ((outline & 4) && w2 <= EDGE_EPS);
      claims[t] = onOutline || claims[t] === 2 ? 2 : 1;
      const k = t * 4;
      const alpha = w0 * a.color[3] + w1 * b.color[3] + w2 * c.color[3];
      for (let ch = 0; ch < 3; ch++) {
        pixels[k + ch] = (w0 * a.color[ch] + w1 * b.color[ch] + w2 * c.color[ch]) * alpha * 255;
      }
      pixels[k + 3] = alpha * 255;
    }
  }
}

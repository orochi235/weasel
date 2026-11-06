import type { Mesh } from '@weasel-js/geom/tessellate';
import type { Paint } from '@weasel-js/paint';
import type { GLMeshHandle } from '../cache/GLMeshCache';
import { POSITION_ATTRIBUTE_LOCATION, type ShaderProgram } from '../shaders/ShaderProgram';
import type { GpuBuffer, GpuGeometry } from '../gpu/types';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import { canBatchMesh, solidColor, stagePlain } from './batch';
import { flushForOwnDraw, retryUncut } from './clip';
import type { DrawContext } from './drawContext';
import { foldsColor } from './foldColor';

type Anchors = Pick<Mesh, 'anchorA' | 'anchorB' | 'anchorT'>;

/**
 * Per-anchor rgba spread to the mesh's vertices, four floats each, by where
 * each vertex sits between two anchors. A mesh with no anchors takes the array
 * as per-vertex already.
 */
export function expandAnchorColors(perAnchor: ArrayLike<number>, mesh: Anchors, out?: Float32Array): Float32Array {
  const aA = mesh.anchorA;
  const aB = mesh.anchorB;
  const aT = mesh.anchorT;
  if (!aA || !aB || !aT) {
    if (out === undefined) return Float32Array.from(perAnchor);
    const len = Math.min(out.length, perAnchor.length);
    for (let i = 0; i < len; i++) out[i] = perAnchor[i];
    return out;
  }
  const n = aA.length;
  const colors = out ?? new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a4 = aA[i] * 4;
    const b4 = aB[i] * 4;
    const t = aT[i];
    for (let c = 0; c < 4; c++) {
      colors[i * 4 + c] = perAnchor[a4 + c] + (perAnchor[b4 + c] - perAnchor[a4 + c]) * t;
    }
  }
  return colors;
}

/** A mesh's geometry with per-vertex colors beside its positions, for one draw. */
export interface VertexColorGeometry {
  readonly geometry: GpuGeometry;
  /** What `releaseVertexColors` frees: the colors and the geometry naming
   *  them, `null` where the program reads no `a_vertexColor`. */
  readonly made: { readonly geometry: GpuGeometry; readonly colors: GpuBuffer } | null;
}

/** `handle`'s geometry with `a_vertexColor` read from a fresh buffer of
 *  per-vertex colors. Pair with `releaseVertexColors` after the draw. */
export function withVertexColors(
  ctx: DrawContext, prog: ShaderProgram, perAnchor: number[], handle: GLMeshHandle,
): VertexColorGeometry {
  const location = prog.attribute('a_vertexColor');
  if (location === undefined) return { geometry: handle.geometry, made: null };
  const gpu = ctx.gpu;
  const colors = gpu.createBuffer('vertex', expandAnchorColors(perAnchor, handle), 'dynamic');
  const geometry = gpu.createGeometry({
    vertexBuffers: [
      { buffer: handle.vertices, stride: 0, attributes: [{ location: POSITION_ATTRIBUTE_LOCATION, components: 2, offset: 0 }] },
      { buffer: colors, stride: 0, attributes: [{ location, components: 4, offset: 0 }] },
    ],
    indexBuffer: handle.indices,
    indexFormat: 'uint32',
  });
  return { geometry, made: { geometry, colors } };
}

export function releaseVertexColors(ctx: DrawContext, { made }: VertexColorGeometry): void {
  if (!made) return;
  ctx.gpu.deleteGeometry(made.geometry);
  ctx.gpu.deleteBuffer(made.colors);
}

/** Reused across stagings: `pushMesh` copies out of it before it is written again. */
let scratch = new Float32Array(256);

/**
 * The fill or stroke color times each vertex's own, mapped by the group's
 * matrix and alpha where the CPU gets what the shader would. Returns whether
 * it did: otherwise the colors are unmapped, for a run entry under the matrix.
 *
 * The CPU's answer is the shader's when no vertex's mapped color leaves 0..1.
 * The map is affine, so mapping the interpolated color is interpolating the
 * mapped ones, and with every corner in range so is every point between them:
 * the shader's clamp has nothing to do. A corner out of range would have its
 * clamp interpolated, where the shader clamps each fragment.
 */
function mapColors(ctx: DrawContext, colors: Float32Array, n: number, base: readonly number[]): boolean {
  for (let i = 0; i < n * 4; i++) colors[i] *= base[i & 3];
  if (!foldsColor(ctx)) return false;
  const m = ctx.state.colorMatrix;
  const alpha = ctx.state.alpha;
  for (let i = 0; i < n * 4; i += 4) {
    const r = colors[i], g = colors[i + 1], b = colors[i + 2], a = colors[i + 3];
    for (let row = 0; row < 4; row++) {
      const k = row * 5;
      const v = m[k] * r + m[k + 1] * g + m[k + 2] * b + m[k + 3] * a + m[k + 4];
      if (!(v >= 0 && v <= 1)) return false;
    }
  }
  for (let i = 0; i < n * 4; i += 4) {
    const r = colors[i], g = colors[i + 1], b = colors[i + 2], a = colors[i + 3];
    colors[i] = m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4];
    colors[i + 1] = m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9];
    colors[i + 2] = m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14];
    colors[i + 3] = (m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]) * alpha;
  }
  return true;
}

/**
 * The color a stroke's vertex colors multiply. Per-vertex colors are the paint
 * there; a non-solid base has no single color to multiply by, so white leaves
 * them unmodified.
 */
export function vertexColorBase(paint: Paint): { color: string; opacity?: number } {
  return paint.kind === undefined || paint.kind === 'solid'
    ? paint as { color: string; opacity?: number }
    : { color: '#ffffff', opacity: paint.opacity };
}

/** What a vertex-colored mesh is staged with: its per-anchor colors and the
 *  solid color they multiply. */
interface Colored { perAnchor: number[]; paint: { color: string; opacity?: number } }

function pushColoredMesh(ctx: DrawContext, mesh: Mesh, colored: Colored): void {
  const n = mesh.vertices.length >> 1;
  if (scratch.length < n * 4) scratch = new Float32Array(Math.max(n * 4, scratch.length * 2));
  const colors = expandAnchorColors(colored.perAnchor, mesh, scratch);
  const folded = mapColors(ctx, colors, n, solidColor(colored.paint));
  const slot = folded
    ? stagePlain(ctx, n, IDENTITY_COLOR_MATRIX, 1)
    : stagePlain(ctx, n, ctx.state.colorMatrix, ctx.state.alpha);
  if (!ctx.drawBatch.pushMesh(mesh, ctx.state.transform, 1, 1, 1, 1, slot, colors)) {
    retryUncut(ctx, mesh, colored, pushColoredMesh);
  }
}

/**
 * Stage a mesh whose vertices carry their own colors, each multiplied by
 * `paint`'s, or drain the run so the caller can draw it itself — the contract
 * `tryStageFill` has. The batch shader's vertex color is straight rgba,
 * interpolated across the triangle and mapped per fragment, which is what the
 * vertex-color program did with its own.
 */
export function tryStageVertexColors(
  ctx: DrawContext, mesh: Mesh, perAnchor: number[], paint: { color: string; opacity?: number },
): boolean {
  const n = mesh.vertices.length >> 1;
  const fits = mesh.anchorA !== undefined || perAnchor.length >= n * 4;
  if (fits && canBatchMesh(ctx, mesh)) {
    pushColoredMesh(ctx, mesh, { perAnchor, paint });
    return true;
  }
  flushForOwnDraw(ctx);
  return false;
}

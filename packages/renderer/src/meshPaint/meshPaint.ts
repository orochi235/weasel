/**
 * The `mesh-gradient` paint kind — PDF's shading types 6 and 7 as a registered
 * paint: a set of curved quadrilateral patches, each with a color at every
 * corner.
 *
 * It uses only the slots `registerPaintKind` gives a consumer, so whatever it
 * can do, a consumer's own kind can do too.
 */

import type { GradStop } from '@weasel-js/paint';
import type { PaintBindContext, PaintDrawKind, PaintProgram, PaintResources } from '../paintKinds';
import { resolveColor, rgbaToHex } from '@weasel-js/paint';
import { mat3 } from '@weasel-js/geom';
import { oklabToOklch, oklabToSrgbU8, oklchToOklab, srgbFloatToOklab } from '@weasel-js/paint';
import type { ColorSpace, Paint, PaintUnits } from '@weasel-js/paint';
import type { FillPoseBox } from '../fillInPoseFrame';
import { bakeMesh, meshBounds, type MeshBox } from './bake';
import { MeshBakeCache, meshBakeSize } from './bakeCache';
import { isValidPatch, type MeshPatch, type MeshPoint } from './surface';
import { MESH_FRAG_SRC, MESH_PROGRAM_ID, MESH_VERT_SRC } from './meshShader';

export type { MeshPatch, MeshPoint } from './surface';

/**
 * A mesh gradient paint.
 *
 * `patches` are in the space `units` names, the same way a gradient's
 * geometry is — under `'bounds'` every point is a fraction of the painted
 * node's box, which is what lets the paint survive a resize.
 *
 * `interpolate` is the space corner colors blend through, matching the three
 * gradients.
 */
export interface MeshGradientPaint {
  kind: 'mesh-gradient';
  patches: MeshPatch[];
  units?: PaintUnits;
  interpolate?: ColorSpace;
  opacity?: number;
}

/** The kind's id, as `Paint['fill']` carries it. */
export const MESH_GRADIENT_KIND = 'mesh-gradient';

/** A mesh paint, narrowed. */
export function isMeshGradientPaint(fill: Paint | null | undefined): fill is Paint & MeshGradientPaint {
  // `Paint`'s discriminant stays closed over the built-in kinds — see
  // `asPaint` — so a registered kind reads it widened.
  return fill != null && (fill.kind as string | undefined) === MESH_GRADIENT_KIND;
}

function asMesh(fill: Paint): MeshGradientPaint {
  return fill as unknown as MeshGradientPaint;
}

// `asPaint`'s cast, kept local: this module must import nothing from the
// registry, whose state the lazy kind's self-contained copy would duplicate.
function asFill(mesh: MeshGradientPaint): Paint {
  return mesh as unknown as Paint;
}

/**
 * `color` moved in OKLCh — lightness, chroma and hue by the given deltas, with
 * its alpha kept. The seed's corners come from one color, and they have to
 * differ enough to read as a mesh rather than as a flat fill.
 */
function shifted(color: string, dL: number, cScale: number, dHueDeg: number): string {
  const [r, g, b, a] = resolveColor(color);
  const [L, A, B] = srgbFloatToOklab(r, g, b);
  const [, C, h] = oklabToOklch(L, A, B);
  const [nL, nA, nB] = oklchToOklab(
    Math.min(1, Math.max(0, L + dL)),
    Math.max(0, C * cScale),
    h + (dHueDeg * Math.PI) / 180,
  );
  const [nr, ng, nb] = oklabToSrgbU8(nL, nA, nB);
  return rgbaToHex([nr / 255, ng / 255, nb / 255, a]);
}

/** A one-patch square covering the unit box, its four corners four readings of
 *  `color` — a mesh seeded from a solid has to show *something* curved, or
 *  switching kind looks like nothing happened. */
export function seedMeshPatch(color: string): MeshGradientPaint {
  const corners: MeshPoint[] = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ];
  const points: MeshPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    // Bow each edge outward by an eighth, so the seed is a patch and not a
    // rectangle wearing one's clothes.
    const nx = (b.y - a.y) * 0.125;
    const ny = -(b.x - a.x) * 0.125;
    points.push(
      a,
      { x: a.x + (b.x - a.x) / 3 + nx, y: a.y + (b.y - a.y) / 3 + ny },
      { x: a.x + (2 * (b.x - a.x)) / 3 + nx, y: a.y + (2 * (b.y - a.y)) / 3 + ny },
    );
  }
  return {
    kind: MESH_GRADIENT_KIND,
    patches: [{
      points,
      colors: [
        color,
        shifted(color, 0.14, 0.85, 0),
        shifted(color, -0.06, 1.1, 38),
        shifted(color, -0.16, 1.0, -22),
      ],
    }],
    units: 'bounds',
  };
}

/** The straight-edged patch covering `[x0, x1] × [0, 1]`, in walk order. */
function bandPatch(x0: number, x1: number, left: string, right: string): MeshPatch {
  const corners: MeshPoint[] = [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 1 }, { x: x0, y: 1 }];
  const points: MeshPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    points.push(a, { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 });
  }
  return { points, colors: [left, right, right, left] };
}

/**
 * A stop list as a mesh: one full-height band per gap between neighboring
 * stops, colored left to right. The bands blend exactly the way the ramp
 * does, so a horizontal gradient survives the switch unchanged. A zero-width
 * gap is a hard break and gets no band.
 */
export function meshFromStops(stops: readonly GradStop[]): MeshGradientPaint {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (sorted.length === 1) sorted.push({ offset: 1, color: sorted[0].color });
  if (sorted.length === 0) return seedMeshPatch('#000000ff');
  const patches: MeshPatch[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b.offset > a.offset) patches.push(bandPatch(a.offset, b.offset, a.color, b.color));
  }
  return { kind: MESH_GRADIENT_KIND, patches, units: 'bounds' };
}

/**
 * A mesh read as a stop list: every patch's top edge — corner 0 to corner 1 —
 * placed by its `x` across the mesh's horizontal extent. The inverse of
 * `meshFromStops`, and for any other mesh the ramp across its top.
 */
export function meshStops(mesh: MeshGradientPaint): GradStop[] {
  const valid = mesh.patches.filter(isValidPatch);
  if (valid.length === 0) return [];
  const xs = valid.flatMap((p) => [p.points[0].x, p.points[3].x]);
  const lo = Math.min(...xs);
  const span = Math.max(...xs) - lo;
  const offsetOf = (x: number) => (span > 0 ? (x - lo) / span : 0);
  const stops: GradStop[] = [];
  for (const patch of valid) {
    for (const [point, color] of [[patch.points[0], patch.colors[0]], [patch.points[3], patch.colors[1]]] as const) {
      const offset = offsetOf(point.x);
      if (!stops.some((s) => s.offset === offset && s.color === color)) stops.push({ offset, color });
    }
  }
  return stops.sort((a, b) => a.offset - b.offset);
}

/** Every patch mapped through `move`. */
function mapPatches(mesh: MeshGradientPaint, move: (p: MeshPoint) => MeshPoint): MeshPatch[] {
  return mesh.patches.map((patch) => ({ ...patch, points: patch.points.map(move) }));
}

// ─── The bake cache ─────────────────────────────────────────────────────────
//
// A kind owns its own GPU state; the registry hands it a `gl` and a resource
// lifetime. One cache per lifetime, so two renderers — or one renderer past a
// context restore — never trade textures, and the lifetime's end frees them.

interface CachedBake {
  texture: WebGLTexture;
  /** Where the mesh being bound sits in paint space. The texels are shared by
   *  every pose-frame copy of one paint; the box is each copy's own. */
  box: MeshBox;
}

/** The paint a pose-frame copy was made from. A copy is rebuilt whenever its
 *  node's pose changes, and bakes the same texels as its source. */
const BAKE_SOURCE = new WeakMap<object, object>();

const CACHES = new WeakMap<PaintResources, MeshBakeCache<WebGLTexture>>();

function cacheFor(ctx: PaintBindContext): MeshBakeCache<WebGLTexture> {
  let cache = CACHES.get(ctx.resources);
  if (!cache) {
    const gl = ctx.gl;
    const made = new MeshBakeCache<WebGLTexture>((texture) => gl.deleteTexture(texture));
    ctx.resources.onRelease(() => {
      made.clear();
      CACHES.delete(ctx.resources);
    });
    CACHES.set(ctx.resources, made);
    cache = made;
  }
  return cache;
}

/** Device pixels the larger side of `box` covers when drawn in `units`. */
function devicePixelsOf(ctx: PaintBindContext, mesh: MeshGradientPaint, box: MeshBox): number {
  const m = ctx.spaceToDevice(mesh.units);
  if (!m) return Number.NaN;
  return Math.max(box.width * Math.hypot(m[0], m[1]), box.height * Math.hypot(m[3], m[4]));
}

function bakeFor(ctx: PaintBindContext, mesh: MeshGradientPaint): CachedBake | null {
  const box = meshBounds(mesh.patches);
  if (!box) return null;
  const size = meshBakeSize(devicePixelsOf(ctx, mesh, box), ctx.maxTextureSize);

  const cache = cacheFor(ctx);
  const key = BAKE_SOURCE.get(mesh) ?? mesh;
  const hit = cache.get(key, size);
  if (hit) return { texture: hit, box };

  const baked = bakeMesh(mesh.patches, mesh.interpolate ?? 'rgb', size);
  if (!baked) return null;

  const gl = ctx.gl;
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA,
    baked.size, baked.size, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, baked.pixels,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  cache.set(key, size, texture);
  return { texture, box };
}

function bindMesh(ctx: PaintBindContext, fill: Paint): PaintProgram | null {
  const mesh = asMesh(fill);
  if (!mesh.patches.some(isValidPatch)) return null;

  const program = ctx.program(MESH_PROGRAM_ID);
  if (!program) return null;

  const entry = bakeFor(ctx, mesh);
  if (!entry) return null;

  const { box } = entry;
  const inverse = ctx.spaceInverse(mesh.units, box);
  if (!inverse) return null;

  const gl = ctx.gl;
  gl.useProgram(program.handle);
  ctx.setProjAndModel(program);
  gl.uniformMatrix3fv(program.uniform('u_worldInv')!, false, mat3.toUniform(inverse));

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, entry.texture);
  gl.uniform1i(program.uniform('u_sampler')!, 0);

  gl.uniform2f(program.uniform('u_meshSize')!, box.width, box.height);
  gl.uniform1f(program.uniform('u_opacity')!, mesh.opacity ?? 1);
  gl.uniform1f(program.uniform('u_alpha')!, ctx.alpha);
  return program;
}

/** The kind's draw half, shader program included. Core adds the editor's
 *  slots and registers the whole entry. */
export const meshDrawKind: PaintDrawKind = {
  id: MESH_GRADIENT_KIND,
  programs: { [MESH_PROGRAM_ID]: { vert: MESH_VERT_SRC, frag: MESH_FRAG_SRC } },
  bind: bindMesh,
  inPoseFrame: (fill, box: FillPoseBox) => {
    const mesh = asMesh(fill);
    if (mesh.units !== 'bounds') return fill;
    const posed = asFill({
      ...mesh,
      patches: mapPatches(mesh, (p) => ({
        x: box.x + p.x * box.width,
        y: box.y + p.y * box.height,
      })),
      units: 'local' as const,
    });
    BAKE_SOURCE.set(posed, fill);
    return posed;
  },
  toBoundsFrame: (fill, box: FillPoseBox) => {
    const mesh = asMesh(fill);
    if (mesh.units === 'bounds' || box.width === 0 || box.height === 0) return fill;
    return asFill({
      ...mesh,
      patches: mapPatches(mesh, (p) => ({
        x: (p.x - box.x) / box.width,
        y: (p.y - box.y) / box.height,
      })),
      units: 'bounds' as const,
    });
  },
};

/**
 * The `<defs>` entry for a mesh paint, in weasel's own namespace.
 *
 * Not SVG's abandoned `<meshgradient>`: that vocabulary only reaches Coons
 * patches, shares patch edges implicitly — a reader that gets the sharing
 * wrong tears the surface rather than failing outright — and has exactly one
 * implementation in the world. Ours writes every patch's points in full.
 * `@weasel-js/svg` puts the paint fallback color beside the reference, so a
 * foreign renderer paints flat instead of nothing.
 */
export function meshGradientXml(id: string, mesh: MeshGradientPaint): string {
  const P = 'wzl';
  const units = mesh.units === 'bounds' ? 'objectBoundingBox' : 'userSpaceOnUse';
  const space = mesh.interpolate && mesh.interpolate !== 'rgb'
    ? ` interpolate="${mesh.interpolate}"` : '';
  const patches = mesh.patches.map((patch) => {
    const points = patch.points.map((p) => `${trim(p.x)},${trim(p.y)}`).join(' ');
    const colors = patch.colors.join(' ');
    return `<${P}:patch points="${points}" colors="${colors}"/>`;
  }).join('');
  return (
    `<${P}:meshGradient id="${id}" gradientUnits="${units}"${space}>` +
    `${patches}</${P}:meshGradient>`
  );
}

/** Short decimals, matching what `@weasel-js/svg` writes elsewhere. */
function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

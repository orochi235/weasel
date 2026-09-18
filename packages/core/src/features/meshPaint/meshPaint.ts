/**
 * The `mesh-gradient` paint kind — PDF's shading types 6 and 7 as a registered
 * paint.
 *
 * A mesh gradient is a set of curved quadrilateral patches, each with a color
 * at every corner. It is the paint SVG tried to standardize as
 * `<meshgradient>` and abandoned, and the one PDF has had since 1993; what it
 * buys over the three gradients is a color field that bends, so a highlight
 * can follow a form instead of running straight across it.
 *
 * This is a registered kind rather than a sixth branch in the renderer, and
 * deliberately: it uses only the slots `registerPaintKind` gives a consumer, so
 * whatever it can do, a consumer's own kind can do too. Its one concession is
 * living in this package, because that is where the shader registry is.
 *
 * `docs/proposals/2026-09-17-paint-kinds-beyond-svg.md` is the design.
 */

import { registerPaintKind, asPaint, type PaintBindContext, type PaintProgram } from '../../core/paintKinds';
import { resolveColor, rgbaToHex } from '../../renderer/math/color';
import { oklabToOklch, oklabToSrgbU8, oklchToOklab, srgbU8ToOklab } from '@weasel-js/paint';
import { registerProgram } from '../../renderer/shaders/registerProgram';
import type { ColorSpace, FillStyle, GradientUnits } from '@weasel-js/paint';
import type { FillPoseBox } from '../../core/fillInPoseFrame';
import { bakeMesh, type BakedMesh } from './bake';
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
 * gradients. It is more visible here than there: a mesh blends in two
 * directions at once, so an sRGB blend's muddy middle covers area rather than
 * a line.
 */
export interface MeshGradientFill {
  fill: 'mesh-gradient';
  patches: MeshPatch[];
  units?: GradientUnits;
  interpolate?: ColorSpace;
  opacity?: number;
}

/** The kind's id, as `FillStyle['fill']` carries it. */
export const MESH_GRADIENT_KIND = 'mesh-gradient';

/** A mesh paint, narrowed. */
export function isMeshGradientFill(fill: FillStyle | null | undefined): fill is FillStyle & MeshGradientFill {
  // `FillStyle`'s discriminant stays closed over the built-in kinds — see
  // `asPaint` — so a registered kind reads it widened.
  return fill != null && (fill.fill as string | undefined) === MESH_GRADIENT_KIND;
}

function asMesh(fill: FillStyle): MeshGradientFill {
  return fill as unknown as MeshGradientFill;
}

/**
 * `color` moved in OKLCh — lightness, chroma and hue by the given deltas, with
 * its alpha kept. The seed's corners come from one color, and they have to
 * differ enough to read as a mesh rather than as a flat fill.
 */
function shifted(color: string, dL: number, cScale: number, dHueDeg: number): string {
  const [r, g, b, a] = resolveColor(color);
  const [L, A, B] = srgbU8ToOklab(r * 255, g * 255, b * 255);
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
export function seedMeshPatch(color: string): MeshGradientFill {
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
    fill: MESH_GRADIENT_KIND,
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

/** Every patch mapped through `move`. */
function mapPatches(mesh: MeshGradientFill, move: (p: MeshPoint) => MeshPoint): MeshPatch[] {
  return mesh.patches.map((patch) => ({ ...patch, points: patch.points.map(move) }));
}

// ─── The bake cache ─────────────────────────────────────────────────────────
//
// A kind owns its own GPU state; the registry hands it a `gl` and nothing
// else. Keyed by the paint object so a cache entry dies with the paint it
// belongs to, and by context so two renderers — or one renderer past a context
// loss — never trade textures.

interface CachedBake {
  texture: WebGLTexture;
  baked: BakedMesh;
}

const BAKES = new WeakMap<WebGL2RenderingContext, WeakMap<object, CachedBake>>();

function bakeFor(gl: WebGL2RenderingContext, mesh: MeshGradientFill): CachedBake | null {
  let perContext = BAKES.get(gl);
  if (!perContext) {
    perContext = new WeakMap();
    BAKES.set(gl, perContext);
  }
  const hit = perContext.get(mesh as unknown as object);
  if (hit) return hit;

  const baked = bakeMesh(mesh.patches, mesh.interpolate ?? 'rgb');
  if (!baked) return null;

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

  const entry = { texture, baked };
  perContext.set(mesh as unknown as object, entry);
  return entry;
}

function bindMesh(ctx: PaintBindContext, fill: FillStyle): PaintProgram | null {
  const mesh = asMesh(fill);
  if (!mesh.patches.some(isValidPatch)) return null;

  const inverse = ctx.spaceInverse(mesh.units);
  if (!inverse) return null;

  const program = ctx.program(MESH_PROGRAM_ID);
  if (!program) return null;

  const entry = bakeFor(ctx.gl, mesh);
  if (!entry) return null;

  const gl = ctx.gl;
  gl.useProgram(program.handle);
  ctx.setProjAndModel(program);
  gl.uniformMatrix3fv(program.uniform('u_worldInv')!, false, inverse);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, entry.texture);
  gl.uniform1i(program.uniform('u_sampler')!, 0);

  const { box } = entry.baked;
  gl.uniform2f(program.uniform('u_meshOrigin')!, box.x, box.y);
  gl.uniform2f(program.uniform('u_meshSize')!, box.width, box.height);
  gl.uniform1f(program.uniform('u_opacity')!, mesh.opacity ?? 1);
  gl.uniform1f(program.uniform('u_alpha')!, ctx.alpha);
  return program;
}

registerProgram(MESH_PROGRAM_ID, MESH_VERT_SRC, MESH_FRAG_SRC);

registerPaintKind({
  id: MESH_GRADIENT_KIND,
  label: 'Mesh',
  icon: 'paintMesh',
  seed: (color) => asPaint(seedMeshPatch(color)),
  // The first corner of the first patch: a mesh has no single color, and this
  // is the one a fallback swatch and an SVG paint fallback both read.
  colorOf: (paint) => asMesh(paint).patches?.[0]?.colors?.[0],
  bind: bindMesh,
  inPoseFrame: (fill, box: FillPoseBox) => {
    const mesh = asMesh(fill);
    if (mesh.units !== 'bounds') return fill;
    return asPaint({
      ...mesh,
      patches: mapPatches(mesh, (p) => ({
        x: box.x + p.x * box.width,
        y: box.y + p.y * box.height,
      })),
      units: 'local' as const,
    });
  },
  toBoundsFrame: (fill, box: FillPoseBox) => {
    const mesh = asMesh(fill);
    if (mesh.units === 'bounds' || box.width === 0 || box.height === 0) return fill;
    return asPaint({
      ...mesh,
      patches: mapPatches(mesh, (p) => ({
        x: (p.x - box.x) / box.width,
        y: (p.y - box.y) / box.height,
      })),
      units: 'bounds' as const,
    });
  },
  toSvg: (id, fill) => meshGradientXml(id, asMesh(fill)),
});

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
export function meshGradientXml(id: string, mesh: MeshGradientFill): string {
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

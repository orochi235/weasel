import type { Paint, TexturePaint } from '@weasel-js/paint';
import { getPaintDrawKind, type PaintBindContext, type PaintResources } from '../paintKinds';
import type { GpuDevice } from '../gpu/types';
import { setUniforms } from './customShader';
import { createPaintResources } from '../paintResources';
import { getTexture, isOwnedTextureId } from '../textures/registerTexture';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { patternTileSpace } from '../math/patternSpace';
import type { DrawContext } from './drawContext';
import { drawModel, setAlphaUniform, setColorMatrixUniforms, setProjAndModel, setSolidPaintUniforms } from './uniforms';
import { gradientSpaceInverse, spaceInverseAbout, spaceToDevice } from './gradient';
import { tileExtent } from './patternBatch';
import { isDev } from '@weasel-js/registry';

/** The narrow renderer surface a registered paint kind binds against, built
 *  once per frame context. `DrawContext` is not consumer surface. */
export function paintBindContext(ctx: DrawContext): PaintBindContext {
  const cached = BIND_CONTEXTS.get(ctx);
  if (cached) return cached;
  const gpu = ctx.gpu;
  const made: PaintBindContext = {
    get alpha() { return ctx.state.alpha; },
    spaceInverse: (units, about) => spaceInverseAbout(ctx, units, about),
    spaceToDevice: (units) => spaceToDevice(ctx, units),
    get maxTextureSize() { return ctx.imageCache.maxTextureSide; },
    resources: ctx.paintResources ?? unownedPaintResources(gpu),
    ramp: (stops, space) => {
      const row = ctx.gradRamps.upload(stops, space);
      return { texture: ctx.gradRamps.atlas()!, v: ctx.gradRamps.rowV(row) };
    },
    createTexture: (width, height, pixels) => gpu.createTexture('rgba8', PAINT_TEXTURE_SAMPLING,
      { width, height, data: pixels }),
    deleteTexture: (texture) => gpu.deleteTexture(texture),
  };
  BIND_CONTEXTS.set(ctx, made);
  return made;
}

const PAINT_TEXTURE_SAMPLING = { min: 'linear', mag: 'linear', wrapS: 'clamp', wrapT: 'clamp' } as const;

const BIND_CONTEXTS = new WeakMap<DrawContext, PaintBindContext>();

const UNOWNED_RESOURCES = new WeakMap<GpuDevice, PaintResources>();

function unownedPaintResources(gpu: GpuDevice): PaintResources {
  let made = UNOWNED_RESOURCES.get(gpu);
  if (!made) {
    made = createPaintResources();
    UNOWNED_RESOURCES.set(gpu, made);
  }
  return made;
}

/**
 * Bind a registered kind's paint: the program its `bind` names, `u_proj` and
 * `u_model` (under `model` and `proj` where given), and the uniforms it hands
 * back. `null` where the kind declines the paint or its program is missing.
 */
export function bindPaintKind(
  ctx: DrawContext, fill: Paint, model?: GlMat3, proj?: GlMat3,
): ShaderProgram | null {
  const bind = getPaintDrawKind(fill.kind)?.bind;
  const binding = bind ? bind(paintBindContext(ctx), fill) : null;
  if (!binding) return null;
  const prog = ctx.ensureProgram?.(binding.program) ?? ctx.programRegistry.get(binding.program) ?? null;
  if (!prog) return null;
  setProjAndModel(ctx, prog, model, proj);
  if (binding.uniforms) setUniforms(ctx, prog, binding.program, binding.uniforms, false);
  return prog;
}

/** Bind `prog` — the path program or the glyph one, which share every paint
 *  uniform — to draw `fill` under `model`. */
export function bindPattern(
  ctx: DrawContext,
  prog: ShaderProgram,
  fill: TexturePaint,
  model: GlMat3,
): ShaderProgram | null {
  const tex = fill.texture;
  const entry = getTexture(tex.id);
  if (!entry) {
    if (isDev() && !isOwnedTextureId(tex.id)) console.warn(`weasel: pattern TextureHandle "${tex.id}" not registered`);
    return null;
  }
  const inverse = gradientSpaceInverse(ctx, fill.units);
  if (!inverse) return null;
  const tileSpace = patternTileSpace(inverse, fill.origin ?? { x: 0, y: 0 }, fill.transform);
  if (!tileSpace) return null;
  ctx.textureCache.uploadRegistered(tex.id, entry.source, 'repeat');

  // A path fill mesh carries a_position only, so the tile coordinate is
  // recovered per fragment from the screen position — the same route
  // gradients take through `u_worldInv`, and the reason this can't reuse
  // the image-fill shader, whose a_uv such a mesh leaves unbound.
  setProjAndModel(ctx, prog, model);
  setColorMatrixUniforms(ctx, prog);
  const [tw, th] = tileExtent(fill, entry);
  // The tile repeats, so whole tiles come out of the translation here, in
  // doubles: far from the origin a float32 has no bits left for the texel.
  tileSpace[6] -= Math.floor(tileSpace[6] / tw) * tw;
  tileSpace[7] -= Math.floor(tileSpace[7] / th) * th;
  prog.set('u_worldInv', 'mat3', mat3.toUniform(tileSpace));
  prog.set2f('u_tileSize', tw, th);
  prog.setTexture('u_sampler', ctx.textureCache.texture(tex.id));
  prog.set1f('u_opacity', fill.opacity ?? 1);
  setAlphaUniform(ctx, prog, ctx.state.alpha);
  return prog;
}

/** The gradient counterpart of `bindPattern`. */
export function bindGradient(
  ctx: DrawContext,
  prog: ShaderProgram,
  fill: Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>,
  model: GlMat3,
): ShaderProgram | null {
  // Measured from the gradient's own start or center.
  const aboutStart = spaceInverseAbout(ctx, fill.units, fill.kind === 'linear-gradient' ? fill.from : fill.center);
  if (!aboutStart) return null;
  const row = ctx.gradRamps.upload(fill.stops, fill.interpolate ?? 'rgb');

  setProjAndModel(ctx, prog, model);

  prog.set('u_worldInv', 'mat3', mat3.toUniform(aboutStart));
  setColorMatrixUniforms(ctx, prog);

  prog.setTexture('u_ramp', ctx.gradRamps.atlas());
  prog.set1f('u_rampV', ctx.gradRamps.rowV(row));
  setAlphaUniform(ctx, prog, ctx.state.alpha);
  prog.set1f('u_opacity', fill.opacity ?? 1);

  if (fill.kind === 'linear-gradient') {
    prog.set1i('u_gradKind', 0);
    const dx = fill.to.x - fill.from.x;
    const dy = fill.to.y - fill.from.y;
    const len = Math.hypot(dx, dy) || 1;
    prog.set2f('u_gradDir', dx / len, dy / len);
    prog.set1f('u_gradLen', len);
    prog.set1f('u_gradRadius', 0);
    prog.set1f('u_gradAngle', 0);
  } else if (fill.kind === 'radial-gradient') {
    prog.set1i('u_gradKind', 1);
    prog.set2f('u_gradDir', 0, 0);
    prog.set1f('u_gradLen', 0);
    prog.set1f('u_gradRadius', fill.radius);
    prog.set1f('u_gradAngle', 0);
  } else {
    // conic
    prog.set1i('u_gradKind', 2);
    prog.set2f('u_gradDir', 0, 0);
    prog.set1f('u_gradLen', 0);
    prog.set1f('u_gradRadius', 0);
    prog.set1f('u_gradAngle', fill.angle);
  }

  return prog;
}

/**
 * Bind the program, uniforms and textures for `fill`, and return the program.
 *
 * Split from the draw so a caller owning its own stencil state draws under
 * that and not the clip test — `drawPathStrokeStenciled` clips a doubled
 * ribbon to one side of the silhouette, which the clip test at depth 0 would
 * not.
 */
export function bindPathFillByKind(ctx: DrawContext, fill: Paint): ShaderProgram | null {
  const kind = fill.kind ?? 'solid';
  if (kind === 'solid') return bindPathFillSolid(ctx, fill as { color: string; opacity?: number });
  if (kind === 'texture') return bindPathFillPattern(ctx, fill as TexturePaint);
  if (kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'conic-gradient') {
    return bindPathFillGradient(ctx, fill as Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>);
  }
  return bindPaintKind(ctx, fill);
}

function bindPathFillSolid(
  ctx: DrawContext,
  fill: { color: string; opacity?: number },
): ShaderProgram {
  const prog = ctx.pathFill;
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);
  return prog;
}

function bindPathFillPattern(
  ctx: DrawContext,
  fill: TexturePaint,
): ShaderProgram | null {
  return bindPattern(ctx, ctx.patternFill, fill, drawModel(ctx));
}

function bindPathFillGradient(
  ctx: DrawContext,
  fill: Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>,
): ShaderProgram | null {
  return bindGradient(ctx, ctx.gradFill, fill, drawModel(ctx));
}

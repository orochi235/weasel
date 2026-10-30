import type { Paint, TexturePaint } from '@weasel-js/paint';
import type { PaintBindContext, PaintResources } from '../paintKinds';
import { createPaintResources } from '../paintResources';
import { getTexture, isOwnedTextureId, type TextureEntry } from '../textures/registerTexture';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { patternTileSpace } from '../math/patternSpace';
import type { DrawContext } from './drawContext';
import { setAlphaUniform, setColorMatrixUniforms, setProjAndModel } from './uniforms';
import { gradientSpaceInverse, spaceInverseAbout, spaceToDevice } from './gradient';
import { isDev } from '@weasel-js/registry';

/** The narrow renderer surface a registered paint kind binds against, built
 *  once per frame context. `DrawContext` is not consumer surface. */
export function paintBindContext(ctx: DrawContext): PaintBindContext {
  const cached = BIND_CONTEXTS.get(ctx);
  if (cached) return cached;
  const made: PaintBindContext = {
    gl: ctx.gl,
    get alpha() { return ctx.state.alpha; },
    program: (id) => ctx.ensureProgram?.(id) ?? ctx.programRegistry.get(id) ?? null,
    setProjAndModel: (prog) => setProjAndModel(ctx, prog),
    spaceInverse: (units, about) => spaceInverseAbout(ctx, units, about),
    spaceToDevice: (units) => spaceToDevice(ctx, units),
    get maxTextureSize() { return ctx.imageCache.maxTextureSide; },
    resources: ctx.paintResources ?? unownedPaintResources(ctx.gl),
    bindRamp: (stops, unit, space) => {
      const row = ctx.gradRamps.upload(stops, space);
      ctx.gradRamps.bind(unit);
      return ctx.gradRamps.rowV(row);
    },
  };
  BIND_CONTEXTS.set(ctx, made);
  return made;
}

const BIND_CONTEXTS = new WeakMap<DrawContext, PaintBindContext>();

const UNOWNED_RESOURCES = new WeakMap<WebGL2RenderingContext, PaintResources>();

function unownedPaintResources(gl: WebGL2RenderingContext): PaintResources {
  let made = UNOWNED_RESOURCES.get(gl);
  if (!made) {
    made = createPaintResources();
    UNOWNED_RESOURCES.set(gl, made);
  }
  return made;
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
  const gl = ctx.gl;
  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog, model);
  setColorMatrixUniforms(ctx, prog);
  const [tw, th] = tileExtent(fill, entry);
  // The tile repeats, so whole tiles come out of the translation here, in
  // doubles: far from the origin a float32 has no bits left for the texel.
  tileSpace[6] -= Math.floor(tileSpace[6] / tw) * tw;
  tileSpace[7] -= Math.floor(tileSpace[7] / th) * th;
  gl.uniformMatrix3fv(prog.uniform('u_worldInv')!, false, mat3.toUniform(tileSpace));
  gl.uniform2f(prog.uniform('u_tileSize')!, tw, th);
  ctx.textureCache.bind(tex.id, 0);
  gl.uniform1i(prog.uniform('u_sampler')!, 0);
  gl.uniform1f(prog.uniform('u_opacity')!, fill.opacity ?? 1);
  setAlphaUniform(ctx, prog, ctx.state.alpha);
  return prog;
}

/** Tile extent in paint-space units — one tile spans this many units of
 *  whatever space `units` names. A side the paint leaves out is the size the
 *  texture stands for, else its pixel size. */
function tileExtent(fill: TexturePaint, { source, size }: TextureEntry): [number, number] {
  const w = fill.width ?? size?.width ?? ('naturalWidth' in source ? source.naturalWidth : source.width);
  const h = fill.height ?? size?.height ?? ('naturalHeight' in source ? source.naturalHeight : source.height);
  return [w > 0 ? w : 1, h > 0 ? h : 1];
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
  const gl = ctx.gl;
  const row = ctx.gradRamps.upload(fill.stops, fill.interpolate ?? 'rgb');

  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog, model);

  gl.uniformMatrix3fv(prog.uniform('u_worldInv')!, false, mat3.toUniform(aboutStart));
  setColorMatrixUniforms(ctx, prog);

  ctx.gradRamps.bind(0);
  gl.uniform1i(prog.uniform('u_ramp')!, 0);
  gl.uniform1f(prog.uniform('u_rampV')!, ctx.gradRamps.rowV(row));
  setAlphaUniform(ctx, prog, ctx.state.alpha);
  gl.uniform1f(prog.uniform('u_opacity')!, fill.opacity ?? 1);

  if (fill.kind === 'linear-gradient') {
    gl.uniform1i(prog.uniform('u_gradKind')!, 0);
    const dx = fill.to.x - fill.from.x;
    const dy = fill.to.y - fill.from.y;
    const len = Math.hypot(dx, dy) || 1;
    gl.uniform2f(prog.uniform('u_gradDir')!, dx / len, dy / len);
    gl.uniform1f(prog.uniform('u_gradLen')!, len);
    gl.uniform1f(prog.uniform('u_gradRadius')!, 0);
    gl.uniform1f(prog.uniform('u_gradAngle')!, 0);
  } else if (fill.kind === 'radial-gradient') {
    gl.uniform1i(prog.uniform('u_gradKind')!, 1);
    gl.uniform2f(prog.uniform('u_gradDir')!, 0, 0);
    gl.uniform1f(prog.uniform('u_gradLen')!, 0);
    gl.uniform1f(prog.uniform('u_gradRadius')!, fill.radius);
    gl.uniform1f(prog.uniform('u_gradAngle')!, 0);
  } else {
    // conic
    gl.uniform1i(prog.uniform('u_gradKind')!, 2);
    gl.uniform2f(prog.uniform('u_gradDir')!, 0, 0);
    gl.uniform1f(prog.uniform('u_gradLen')!, 0);
    gl.uniform1f(prog.uniform('u_gradRadius')!, 0);
    gl.uniform1f(prog.uniform('u_gradAngle')!, fill.angle);
  }

  return prog;
}

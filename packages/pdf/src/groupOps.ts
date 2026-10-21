import { mat3 } from '@weasel-js/geom';
import {
  commandsBounds,
  type DrawCommand,
  type GroupDrawCommand,
  isOwnComposite,
  leavesUncovered,
  type PathDrawCommand,
  readsBackdrop,
  type ShaderDrawCommand,
} from '@weasel-js/renderer';
import { composeMatrix, foldPixels } from './color';
import { ContentStream } from './content';
import { type DrawState, type PageCtx, pageFlip, pageThrough, skip, writeCommands } from './drawCommands';
import { writeRaster } from './images';
import { name } from './objects';
import { fillPathOps } from './pathOps';
import { PageResources } from './resources';
import type { RasterPixels, Rect } from './writePdf';

/** Rasters are made at twice the page's point scale. */
const RASTER_SCALE = 2;

/** The renderer clips through the fill mesh, so a clip covers what a fill of its path would. */
function setClip(ctx: PageCtx, clip: NonNullable<GroupDrawCommand['clip']>): void {
  ctx.out.op(fillPathOps(ctx.out, clip) ? 'W*' : 'W');
  ctx.out.op('n');
}

function compositeName(op: NonNullable<GroupDrawCommand['composite']>): string {
  return typeof op === 'string' ? op : `${op.source}/${op.destination}`;
}

/**
 * Hands `commands` (already in the page's frame) to the raster hook and draws what comes back over `box`.
 * The pixels are folded through `state`'s color matrix and drawn at its alpha. `unhooked` is the skip
 * reported when there is no hook. `paper` paints the box white first, for a raster that replaces
 * what was drawn there rather than joining it.
 */
async function drawRaster(
  ctx: PageCtx,
  commands: readonly DrawCommand[],
  box: Rect,
  state: DrawState,
  reason: string,
  unhooked = reason,
  paper = false,
): Promise<void> {
  const hook = ctx.opts.rasterize;
  if (!hook) return skip(ctx, unhooked);
  if (box.width <= 0 || box.height <= 0) return;
  let px: RasterPixels;
  try {
    px = await hook(commands, box, RASTER_SCALE, ctx.view);
  } catch (err) {
    return skip(ctx, `${reason} raster failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (px.data.length !== px.width * px.height * 4) return skip(ctx, `${reason} raster has the wrong number of pixels`);
  const inverse = mat3.invert(state.transform);
  if (!inverse) return;
  const { out } = ctx;
  out.op('q');
  out.op('cm', ...mat3.toAffine(inverse));
  if (paper) {
    out.op('rg', 1, 1, 1);
    out.op('re', box.x, box.y, box.width, box.height);
    out.op('f');
  }
  writeRaster(ctx, { ...px, data: foldPixels(px.data, state) }, box, state.alpha);
  out.op('Q');
}

/** A shader command's bounds are screen space, which is the page's frame here. */
export function writeShader(ctx: PageCtx, cmd: ShaderDrawCommand, state: DrawState): Promise<void> {
  const { x, y, w, h } = cmd.bounds;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(ctx.width, Math.ceil(x + w));
  const y1 = Math.min(ctx.height, Math.ceil(y + h));
  return drawRaster(ctx, [cmd], { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, state, 'shader');
}

/** A fill in a paint kind only the renderer can draw, rasterized on its own in the page's frame. */
export function rasterFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState, kind: string): Promise<void> {
  const wrapper: GroupDrawCommand = {
    kind: 'group',
    transform: state.transform,
    children: [{ kind: 'path', path: cmd.path, fill: cmd.fill }],
  };
  const box = commandsBounds([wrapper], mat3.identity(), ctx);
  return drawRaster(ctx, [wrapper], box, state, `paint kind ${kind}`, `paint kind ${kind} needs a raster`);
}

/** `cmd`'s drawing, without its alpha, color matrix or composite, moved into the page's frame. */
function inPageFrame(cmd: GroupDrawCommand, state: DrawState): GroupDrawCommand {
  const full = cmd.transform ? mat3.multiply(Float64Array.from(state.transform), cmd.transform) : state.transform;
  return { kind: 'group', transform: full, clip: cmd.clip, effects: cmd.effects, children: cmd.children };
}

/** The group's own frame is dropped from the state: its alpha and color matrix apply to the finished raster. */
async function rasterGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState, reason: string): Promise<void> {
  const wrapper = inPageFrame(cmd, state);
  const box = commandsBounds([wrapper], mat3.identity(), ctx, RASTER_SCALE);
  const grouped: DrawState = {
    transform: state.transform,
    alpha: state.alpha * (cmd.alpha ?? 1),
    colorMatrix: composeMatrix(state.colorMatrix, cmd.colorMatrix),
  };
  await drawRaster(ctx, [wrapper], box, grouped, reason);
}

/**
 * A composite PDF has no operator for, drawn by the renderer onto the page beneath it and placed over
 * what it changes: the group's bounds, or the whole page for an operator that clears what the group
 * leaves empty. The page so far is under every enclosing group, so the raster is placed as it comes.
 */
function compositeGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState): Promise<void> {
  const composite = cmd.composite!;
  const box = leavesUncovered(composite)
    ? commandsBounds([inPageFrame(cmd, state)], mat3.identity(), ctx, RASTER_SCALE)
    : { x: 0, y: 0, width: ctx.width, height: ctx.height };
  const reason = `composite ${compositeName(composite)}`;
  const placed: DrawState = { transform: state.transform, alpha: 1, colorMatrix: null };
  return drawRaster(ctx, pageThrough(ctx.trail), box, placed, reason, reason, true);
}

/**
 * The children in a form of their own, so a group's alpha lands on the finished surface. The form is
 * drawn from the page's default space, which is what a tiling pattern's matrix inside it is relative to.
 */
async function isolatedGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState, inner: DrawState): Promise<void> {
  if (cmd.colorMatrix?.[19]) skip(ctx, 'group color matrix alpha offset is not drawn');
  const flip = pageFlip(ctx);
  const toPage = mat3.multiply(flip, Float64Array.from(state.transform));
  const fromPage = mat3.invert(toPage);
  if (!fromPage) return;
  const sub: PageCtx = { ...ctx, out: new ContentStream(), resources: new PageResources() };
  sub.out.op('cm', ...mat3.toAffine(mat3.multiply(flip, Float64Array.from(inner.transform))));
  if (cmd.clip) setClip(sub, cmd.clip);
  await writeCommands(sub, cmd.children, { ...inner, alpha: 1 }, cmd);

  const form = ctx.objects.alloc();
  ctx.objects.streamDeflated(
    form,
    {
      Type: name('XObject'),
      Subtype: name('Form'),
      BBox: [0, 0, ctx.width, ctx.height],
      Group: { Type: name('Group'), S: name('Transparency'), I: true },
      Resources: sub.resources.dict(),
    },
    sub.out.bytes(),
  );
  const { out } = ctx;
  out.op('q');
  out.op('cm', ...mat3.toAffine(fromPage));
  if (inner.alpha < 1) out.op('gs', `/${ctx.resources.extGState(inner.alpha, inner.alpha)}`);
  out.op('Do', `/${ctx.resources.xobject(form)}`);
  out.op('Q');
}

export async function writeGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState): Promise<void> {
  const hooked = ctx.opts.rasterize !== undefined;
  if (cmd.composite && isOwnComposite(cmd.composite)) {
    if (hooked) return compositeGroup(ctx, cmd, state);
    skip(ctx, `composite ${compositeName(cmd.composite)} drawn as source-over`);
  }
  if (cmd.effects?.length) return rasterGroup(ctx, cmd, state, 'effects');
  // A form has no paper to put a raster on, so the whole isolated surface is drawn by the renderer.
  if (cmd.isolate && hooked && readsBackdrop(cmd.children)) return rasterGroup(ctx, cmd, state, 'composite');
  const m = cmd.transform;
  const inner: DrawState = {
    transform: m ? mat3.multiply(Float64Array.from(state.transform), m) : state.transform,
    alpha: state.alpha * (cmd.alpha ?? 1),
    colorMatrix: composeMatrix(state.colorMatrix, cmd.colorMatrix),
  };
  if (cmd.isolate) return isolatedGroup(ctx, cmd, state, inner);
  const { out } = ctx;
  out.op('q');
  if (m) out.op('cm', ...mat3.toAffine(m));
  if (cmd.clip) setClip(ctx, cmd.clip);
  await writeCommands(ctx, cmd.children, inner, cmd);
  out.op('Q');
}

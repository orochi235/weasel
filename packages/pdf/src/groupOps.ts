import { type GlMat3, mat3 } from '@weasel-js/geom';
import {
  commandsBounds,
  type DrawCommand,
  type GroupDrawCommand,
  isOwnComposite,
  type PathDrawCommand,
  type ShaderDrawCommand,
} from '@weasel-js/renderer';
import { composeMatrix, foldPixels } from './color';
import { ContentStream } from './content';
import { type DrawState, type PageCtx, writeCommands } from './drawCommands';
import { writeRaster } from './images';
import { name } from './objects';
import { fillPathOps } from './pathOps';
import { PageResources } from './resources';
import type { RasterPixels, Rect } from './writePdf';

/** Rasters are made at twice the page's point scale. */
const RASTER_SCALE = 2;

function skip(ctx: PageCtx, detail: string): void {
  ctx.skipped.push({ kind: 'command', detail });
}

const cm = (m: GlMat3): [number, number, number, number, number, number] => [m[0], m[1], m[3], m[4], m[6], m[7]];

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
 * reported when there is no hook.
 */
async function drawRaster(
  ctx: PageCtx,
  commands: readonly DrawCommand[],
  box: Rect,
  state: DrawState,
  reason: string,
  unhooked = reason,
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
  out.op('cm', ...cm(inverse));
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

/** The group's own frame is dropped from the state: its alpha and color matrix apply to the finished raster. */
async function rasterGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState, reason: string): Promise<void> {
  const full = cmd.transform ? mat3.multiply(Float64Array.from(state.transform), cmd.transform) : state.transform;
  const wrapper: GroupDrawCommand = {
    kind: 'group',
    transform: full,
    clip: cmd.clip,
    effects: cmd.effects,
    children: cmd.children,
  };
  const box = commandsBounds([wrapper], mat3.identity(), ctx);
  const grouped: DrawState = {
    transform: state.transform,
    alpha: state.alpha * (cmd.alpha ?? 1),
    colorMatrix: composeMatrix(state.colorMatrix, cmd.colorMatrix),
  };
  await drawRaster(ctx, [wrapper], box, grouped, reason);
}

/**
 * The children in a form of their own, so a group's alpha lands on the finished surface. The form is
 * drawn from the page's default space, which is what a tiling pattern's matrix inside it is relative to.
 */
async function isolatedGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState, inner: DrawState): Promise<void> {
  if (cmd.colorMatrix?.[19]) skip(ctx, 'group color matrix alpha offset is not drawn');
  const flip = mat3.fromAffine([1, 0, 0, -1, 0, ctx.height]);
  const toPage = mat3.multiply(flip, Float64Array.from(state.transform));
  const fromPage = mat3.invert(toPage);
  if (!fromPage) return;
  const sub: PageCtx = { ...ctx, out: new ContentStream(), resources: new PageResources() };
  sub.out.op('cm', ...cm(mat3.multiply(flip, Float64Array.from(inner.transform))));
  if (cmd.clip) setClip(sub, cmd.clip);
  await writeCommands(sub, cmd.children, { ...inner, alpha: 1 });

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
  out.op('cm', ...cm(fromPage));
  if (inner.alpha < 1) out.op('gs', `/${ctx.resources.extGState(inner.alpha, inner.alpha)}`);
  out.op('Do', `/${ctx.resources.xobject(form)}`);
  out.op('Q');
}

export async function writeGroup(ctx: PageCtx, cmd: GroupDrawCommand, state: DrawState): Promise<void> {
  if (cmd.composite && isOwnComposite(cmd.composite)) {
    skip(ctx, `composite ${compositeName(cmd.composite)} drawn as source-over`);
  }
  if (cmd.effects?.length) return rasterGroup(ctx, cmd, state, 'effects');
  const m = cmd.transform;
  const inner: DrawState = {
    transform: m ? mat3.multiply(Float64Array.from(state.transform), m) : state.transform,
    alpha: state.alpha * (cmd.alpha ?? 1),
    colorMatrix: composeMatrix(state.colorMatrix, cmd.colorMatrix),
  };
  if (cmd.isolate) return isolatedGroup(ctx, cmd, state, inner);
  const { out } = ctx;
  out.op('q');
  if (m) out.op('cm', ...cm(m));
  if (cmd.clip) setClip(ctx, cmd.clip);
  await writeCommands(ctx, cmd.children, inner);
  out.op('Q');
}

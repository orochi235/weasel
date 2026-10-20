import { fillsOpenSubpaths, type GlMat3, mat3, type Path } from '@weasel-js/geom';
import { type CommandPaint, isGradientPaint, isSolidPaint } from '@weasel-js/paint';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { colorFor } from './color';
import type { ContentStream } from './content';
import { type TextureFill, texturePattern, writeImage } from './images';
import type { PdfObjects } from './objects';
import { pathOps } from './pathOps';
import type { PageResources } from './resources';
import { paintShading } from './shading';
import { writeStroke } from './strokeOps';
import type { PdfSkip, WritePdfOptions } from './writePdf';

export interface DrawState {
  transform: GlMat3;
  alpha: number;
  colorMatrix: number[] | null;
}

export interface PageCtx {
  objects: PdfObjects;
  resources: PageResources;
  out: ContentStream;
  opts: WritePdfOptions;
  skipped: PdfSkip[];
  view: GlMat3 | undefined;
  /** The page's height in points, which a pattern's matrix needs to undo the page flip. */
  height: number;
}

function skip(ctx: PageCtx, detail: string): void {
  ctx.skipped.push({ kind: 'command', detail });
}

function setAlpha(ctx: PageCtx, fill: number, stroke: number): void {
  ctx.out.op('gs', `/${ctx.resources.extGState(fill, stroke)}`);
}

/** Writes the fill's path and answers whether it fills even-odd. */
function fillPathOps(out: ContentStream, path: Path): boolean {
  const closeOpen = path.kind === 'rect' || fillsOpenSubpaths(path);
  pathOps(out, path, closeOpen ? 'all' : 'closed');
  return path.kind === 'polygon' && path.fillRule === 'evenodd';
}

function writeShadedFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState, paint: CommandPaint): void {
  const sh = paintShading(ctx, paint, state, cmd.path);
  if (!sh) return;
  const { out } = ctx;
  out.op('q');
  out.op(fillPathOps(out, cmd.path) ? 'W*' : 'W');
  out.op('n');
  if (sh.alpha < 1) setAlpha(ctx, sh.alpha, sh.alpha);
  if (sh.matrix) out.op('cm', sh.matrix[0], sh.matrix[1], sh.matrix[3], sh.matrix[4], sh.matrix[6], sh.matrix[7]);
  if (sh.softMask) out.op('gs', `/${sh.softMask}`);
  out.op('sh', `/${sh.shading}`);
  out.op('Q');
}

function writeTextureFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState, paint: TextureFill): void {
  const pattern = texturePattern(ctx, paint, state);
  if (!pattern) return skip(ctx, `texture ${paint.texture.id} cannot be drawn`);
  const alpha = (paint.opacity ?? 1) * state.alpha;
  const { out } = ctx;
  out.op('q');
  setAlpha(ctx, alpha, alpha);
  out.op('cs', '/Pattern');
  out.op('scn', `/${pattern}`);
  out.op(fillPathOps(out, cmd.path) ? 'f*' : 'f');
  out.op('Q');
}

function writeFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState): void {
  const paint = cmd.fill?.paint;
  if (!paint) return;
  if (isGradientPaint(paint)) return writeShadedFill(ctx, cmd, state, paint);
  if (paint.kind === 'texture') return writeTextureFill(ctx, cmd, state, paint);
  if (!isSolidPaint(paint)) return skip(ctx, 'fill paint not yet supported');
  const [r, g, b, a] = colorFor(paint.color, state);
  const alpha = a * (paint.opacity ?? 1) * state.alpha;
  const { out } = ctx;
  out.op('q');
  setAlpha(ctx, alpha, alpha);
  out.op('rg', r, g, b);
  out.op(fillPathOps(out, cmd.path) ? 'f*' : 'f');
  out.op('Q');
}

async function writePath(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState): Promise<void> {
  writeFill(ctx, cmd, state);
  if (cmd.stroke) await writeStroke(ctx, cmd.path, cmd.stroke, state);
}

async function writeGroup(
  ctx: PageCtx,
  cmd: Extract<DrawCommand, { kind: 'group' }>,
  state: DrawState,
): Promise<void> {
  if (cmd.effects?.length) skip(ctx, 'group effects not yet supported');
  if (cmd.isolate) skip(ctx, 'group isolate not yet supported');
  if (cmd.composite) skip(ctx, 'group composite not yet supported');
  if (cmd.colorMatrix) skip(ctx, 'group colorMatrix not yet supported');
  const { out } = ctx;
  const m = cmd.transform;
  out.op('q');
  if (m) out.op('cm', m[0], m[1], m[3], m[4], m[6], m[7]);
  if (cmd.clip) {
    pathOps(out, cmd.clip, 'all');
    out.op(cmd.clip.kind === 'polygon' && cmd.clip.fillRule === 'evenodd' ? 'W*' : 'W');
    out.op('n');
  }
  await writeCommands(ctx, cmd.children, {
    transform: m ? mat3.multiply(Float64Array.from(state.transform), m) : state.transform,
    alpha: state.alpha * (cmd.alpha ?? 1),
    colorMatrix: state.colorMatrix,
  });
  out.op('Q');
}

export async function writeCommands(ctx: PageCtx, cmds: readonly DrawCommand[], state: DrawState): Promise<void> {
  for (const cmd of cmds) {
    if (cmd.kind === 'path') await writePath(ctx, cmd, state);
    else if (cmd.kind === 'group') await writeGroup(ctx, cmd, state);
    else if (cmd.kind === 'image' || cmd.kind === 'sprites') writeImage(ctx, cmd, state);
    else skip(ctx, `${cmd.kind} not yet supported`);
  }
}

import { type GlMat3, mat3 } from '@weasel-js/geom';
import { type CommandPaint, isGradientPaint, isSolidPaint } from '@weasel-js/paint';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { solidColor } from './color';
import type { ContentStream } from './content';
import type { DocumentFonts } from './fonts/embedFont';
import { rasterFill, writeGroup, writeShader } from './groupOps';
import { type TextureFill, texturePattern, writeImage } from './images';
import type { PdfObjects } from './objects';
import { NonFiniteNumber } from './num';
import { fillPathOps } from './pathOps';
import type { PageResources } from './resources';
import { paintShading } from './shading';
import { writeStroke } from './strokeOps';
import { writeText } from './textOps';
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
  fonts: DocumentFonts;
  skipped: PdfSkip[];
  view: GlMat3 | undefined;
  /** The page's width in points. */
  width: number;
  /** The page's height in points, which a pattern's matrix needs to undo the page flip. */
  height: number;
}

export function skip(ctx: PageCtx, detail: string): void {
  ctx.skipped.push({ kind: 'command', detail });
}

/** The page's default space from its y-down frame, origin top left: the matrix every content stream opens with. */
export function pageFlip(ctx: { height: number }): GlMat3 {
  return mat3.fromAffine([1, 0, 0, -1, 0, ctx.height]);
}

function setAlpha(ctx: PageCtx, fill: number, stroke: number): void {
  ctx.out.op('gs', `/${ctx.resources.extGState(fill, stroke)}`);
}

function writeShadedFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState, paint: CommandPaint): void {
  const sh = paintShading(ctx, paint, state, cmd.path);
  if (!sh) return;
  const { out } = ctx;
  out.op('q');
  out.op(fillPathOps(out, cmd.path) ? 'W*' : 'W');
  out.op('n');
  if (sh.alpha < 1) setAlpha(ctx, sh.alpha, sh.alpha);
  if (sh.matrix) out.op('cm', ...mat3.toAffine(sh.matrix));
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

async function writeFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState): Promise<void> {
  const paint = cmd.fill?.paint;
  if (!paint) return;
  if (isGradientPaint(paint)) return writeShadedFill(ctx, cmd, state, paint);
  if (paint.kind === 'texture') return writeTextureFill(ctx, cmd, state, paint);
  // A registered paint kind, which the paint union does not name.
  if (!isSolidPaint(paint)) return rasterFill(ctx, cmd, state, (paint as { kind: string }).kind);
  if (cmd.vertexColors?.length) skip(ctx, 'fill vertexColors approximated by the solid fill');
  const { rgb, alpha } = solidColor(paint, state);
  const { out } = ctx;
  out.op('q');
  setAlpha(ctx, alpha, alpha);
  out.op('rg', ...rgb);
  out.op(fillPathOps(out, cmd.path) ? 'f*' : 'f');
  out.op('Q');
}

async function writePath(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState): Promise<void> {
  await writeFill(ctx, cmd, state);
  if (cmd.stroke) await writeStroke(ctx, cmd.path, cmd.stroke, state);
}

async function writeCommand(ctx: PageCtx, cmd: DrawCommand, state: DrawState): Promise<void> {
  if (cmd.kind === 'path') await writePath(ctx, cmd, state);
  else if (cmd.kind === 'group') await writeGroup(ctx, cmd, state);
  else if (cmd.kind === 'image' || cmd.kind === 'sprites') writeImage(ctx, cmd, state);
  else if (cmd.kind === 'text') await writeText(ctx, cmd, state);
  else await writeShader(ctx, cmd, state);
}

/** Writes each command; one holding a number PDF cannot write is dropped whole and reported. */
export async function writeCommands(ctx: PageCtx, cmds: readonly DrawCommand[], state: DrawState): Promise<void> {
  for (const cmd of cmds) {
    const line = ctx.out.mark();
    const object = ctx.objects.mark();
    const skips = ctx.skipped.length;
    try {
      await writeCommand(ctx, cmd, state);
    } catch (err) {
      if (!(err instanceof NonFiniteNumber)) throw err;
      ctx.out.rollback(line);
      ctx.objects.nullUnset(object);
      ctx.skipped.length = skips;
      skip(ctx, `${cmd.kind} has a non-finite coordinate`);
    }
  }
}

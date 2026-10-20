import { fillsOpenSubpaths, type GlMat3, mat3, type Path } from '@weasel-js/geom';
import { isSolidPaint, parseColor, resolveScreenLength } from '@weasel-js/paint';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import type { ContentStream } from './content';
import type { PdfObjects } from './objects';
import { pathOps } from './pathOps';
import type { PageResources } from './resources';
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
}

type Rgba = [number, number, number, number];

/** Every color the writer emits comes through here, so a color matrix has one place to apply. */
function colorFor(color: string, _state: DrawState): Rgba {
  return parseColor(color);
}

function skip(ctx: PageCtx, detail: string): void {
  ctx.skipped.push({ kind: 'command', detail });
}

function setAlpha(ctx: PageCtx, fill: number, stroke: number): void {
  ctx.out.op('gs', `/${ctx.resources.extGState(fill, stroke)}`);
}

function writeFill(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState): void {
  const paint = cmd.fill?.paint;
  if (!paint) return;
  if (!isSolidPaint(paint)) return skip(ctx, 'gradient fill not yet supported');
  const [r, g, b, a] = colorFor(paint.color, state);
  const alpha = a * (paint.opacity ?? 1) * state.alpha;
  const { out } = ctx;
  out.op('q');
  setAlpha(ctx, alpha, alpha);
  out.op('rg', r, g, b);
  const path = cmd.path;
  const closeOpen = path.kind === 'rect' || fillsOpenSubpaths(path);
  pathOps(out, path, closeOpen ? 'all' : 'closed');
  out.op(path.kind === 'polygon' && path.fillRule === 'evenodd' ? 'f*' : 'f');
  out.op('Q');
}

/** A plain native stroke; dashes, joins, caps and alignment are not written yet. */
function writeStrokePlain(ctx: PageCtx, path: Path, cmd: PathDrawCommand, state: DrawState): void {
  const stroke = cmd.stroke;
  const paint = stroke?.paint;
  if (!stroke || !paint) return;
  if (!isSolidPaint(paint)) return skip(ctx, 'gradient stroke not yet supported');
  const [r, g, b, a] = colorFor(paint.color, state);
  const alpha = a * (paint.opacity ?? 1) * state.alpha;
  const { out } = ctx;
  out.op('q');
  setAlpha(ctx, alpha, alpha);
  out.op('RG', r, g, b);
  out.op('w', resolveScreenLength(stroke.width ?? 1, mat3.meanScaleOf(state.transform)));
  pathOps(out, path, 'all');
  out.op('S');
  out.op('Q');
}

function writePath(ctx: PageCtx, cmd: PathDrawCommand, state: DrawState): void {
  if (cmd.vertexColors) skip(ctx, 'vertexColors not yet supported');
  writeFill(ctx, cmd, state);
  writeStrokePlain(ctx, cmd.path, cmd, state);
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
    if (cmd.kind === 'path') writePath(ctx, cmd, state);
    else if (cmd.kind === 'group') await writeGroup(ctx, cmd, state);
    else skip(ctx, `${cmd.kind} not yet supported`);
  }
}

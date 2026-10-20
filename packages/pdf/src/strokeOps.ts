import type { Path } from '@weasel-js/geom';
import { type CommandPaint, type CommandStroke, isSolidPaint, type Stroke } from '@weasel-js/paint';
import { markerDrawCommands, resolveStrokeLengths } from '@weasel-js/renderer';
import { strokeInsets, strokeToPath } from '@weasel-js/stroke';
import { colorFor } from './color';
import { type DrawState, type PageCtx, writeCommands } from './drawCommands';
import { num } from './num';
import { pathOps } from './pathOps';

const CAPS = { butt: 0, round: 1, square: 2 } as const;
const JOINS = { miter: 0, round: 1, bevel: 2 } as const;

/** Whether PDF's own stroke operator draws this stroke as the renderer would. */
export function isNative(stroke: CommandStroke, width: number): boolean {
  if (stroke.align && stroke.align !== 'center') return false;
  if (stroke.vertexWidths || stroke.nib || stroke.vertexColors) return false;
  const { start, end } = strokeInsets(stroke as Stroke, width);
  return start === 0 && end === 0;
}

/** The line style operators for a native stroke; the caller sets its color. */
export function strokeStyleOps(ctx: PageCtx, stroke: CommandStroke, width: number): void {
  const { out } = ctx;
  out.op('w', width);
  out.op('J', CAPS[stroke.cap ?? 'butt']);
  out.op('j', JOINS[stroke.join ?? 'miter']);
  out.op('M', stroke.miterLimit ?? 4);
  // An all-zero dash draws nothing in PDF, and the renderer draws it solid.
  const dash = stroke.dash ?? [];
  if (dash.reduce((a, b) => a + b, 0) > 0) out.op('d', `[${dash.map(num).join(' ')}]`, 0);
}

/** `raw` with its `{ px }` lengths resolved at the exact scale of `state`, and its width as a number. */
export function resolveStroke(
  path: Path,
  raw: CommandStroke & { paint: CommandPaint },
  state: DrawState,
): { stroke: CommandStroke & { paint: CommandPaint }; width: number } {
  const { cmd } = resolveStrokeLengths(state.transform, { kind: 'path', path, stroke: raw }, { quantize: false });
  return { stroke: cmd.stroke, width: typeof cmd.stroke.width === 'number' ? cmd.stroke.width : 1 };
}

function writeNative(ctx: PageCtx, path: Path, stroke: CommandStroke, state: DrawState, width: number): void {
  const paint = stroke.paint;
  if (!paint || !isSolidPaint(paint)) return;
  const [r, g, b, a] = colorFor(paint.color, state);
  const alpha = a * (paint.opacity ?? 1) * state.alpha;
  const { out } = ctx;
  out.op('q');
  out.op('gs', `/${ctx.resources.extGState(alpha, alpha)}`);
  out.op('RG', r, g, b);
  strokeStyleOps(ctx, stroke, width);
  pathOps(out, path, 'all');
  out.op('S');
  out.op('Q');
}

/**
 * Strokes `path`: natively where PDF draws it as the renderer does, otherwise by
 * filling the stroke's outline, which also carries gradient paints. Marker heads
 * follow as their own commands; heads with their own paint are drawn over the
 * line-colored copy that `strokeToPath` already unioned into the outline.
 */
export async function writeStroke(ctx: PageCtx, path: Path, rawStroke: CommandStroke, state: DrawState): Promise<void> {
  if (!rawStroke.paint) return;
  const { stroke, width } = resolveStroke(path, { ...rawStroke, paint: rawStroke.paint as CommandPaint }, state);
  if (!(width > 0)) return;
  let heads =
    stroke.markerStart || stroke.markerMid || stroke.markerEnd
      ? markerDrawCommands(path, stroke, width, undefined)
      : [];
  if (isNative(stroke, width) && isSolidPaint(stroke.paint)) writeNative(ctx, path, stroke, state, width);
  else {
    if (stroke.vertexColors) {
      ctx.skipped.push({ kind: 'command', detail: 'stroke vertexColors approximated by a single paint' });
    }
    heads = heads.filter((h) => h.stroke || h.fill?.paint !== stroke.paint);
    const outline = strokeToPath(path, stroke as Stroke);
    await writeCommands(ctx, [{ kind: 'path', path: outline, fill: { paint: stroke.paint } }], state);
  }
  if (heads.length) await writeCommands(ctx, heads, state);
}

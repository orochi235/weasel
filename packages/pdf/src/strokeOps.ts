import { mat3, type Path } from '@weasel-js/geom';
import { type CommandStroke, isSolidPaint, resolveScreenLength, type Stroke } from '@weasel-js/paint';
import { markerDrawCommands } from '@weasel-js/renderer';
import { resolveStrokeWidth, strokeInsets, strokeToPath } from '@weasel-js/stroke';
import { colorFor } from './color';
import { type DrawState, type PageCtx, writeCommands } from './drawCommands';
import { pathOps } from './pathOps';

const CAPS = { butt: 0, round: 1, square: 2 } as const;
const JOINS = { miter: 0, round: 1, bevel: 2 } as const;

/** Whether PDF's own stroke operator draws this stroke as the renderer would. */
function isNative(stroke: CommandStroke, width: number): boolean {
  if (stroke.align && stroke.align !== 'center') return false;
  if (stroke.vertexWidths || stroke.nib || stroke.vertexColors) return false;
  const { start, end } = strokeInsets(stroke as Stroke, width);
  return start === 0 && end === 0;
}

function writeNative(ctx: PageCtx, path: Path, stroke: CommandStroke, state: DrawState, scale: number): void {
  const paint = stroke.paint;
  if (!paint || !isSolidPaint(paint)) return;
  const [r, g, b, a] = colorFor(paint.color, state);
  const alpha = a * (paint.opacity ?? 1) * state.alpha;
  const { out } = ctx;
  out.op('q');
  out.op('gs', `/${ctx.resources.extGState(alpha, alpha)}`);
  out.op('RG', r, g, b);
  out.op('w', resolveStrokeWidth(stroke.width ?? 1, scale));
  out.op('J', CAPS[stroke.cap ?? 'butt']);
  out.op('j', JOINS[stroke.join ?? 'miter']);
  out.op('M', stroke.miterLimit ?? 4);
  if (stroke.dash?.length) {
    const unit = typeof stroke.width === 'object' ? resolveScreenLength({ px: 1 }, scale) : 1;
    out.op('d', `[${stroke.dash.map((d) => d * unit).join(' ')}]`, 0);
  }
  pathOps(out, path, 'all');
  out.op('S');
  out.op('Q');
}

/**
 * Strokes `path`: natively where PDF draws it as the renderer does, otherwise by
 * filling the stroke's outline, which also carries gradient paints. Marker heads
 * follow as their own commands.
 */
export async function writeStroke(ctx: PageCtx, path: Path, stroke: CommandStroke, state: DrawState): Promise<void> {
  if (!stroke.paint) return;
  const scale = mat3.meanScaleOf(state.transform);
  const width = resolveStrokeWidth(stroke.width ?? 1, scale);
  let heads =
    stroke.markerStart || stroke.markerMid || stroke.markerEnd
      ? markerDrawCommands(path, stroke, width, undefined)
      : [];
  if (isNative(stroke, width) && isSolidPaint(stroke.paint)) writeNative(ctx, path, stroke, state, scale);
  else {
    // The outline already contains every head, in the line's paint.
    heads = heads.filter((h) => h.stroke || h.fill?.paint !== stroke.paint);
    const outline = strokeToPath(path, stroke as Stroke, { scale });
    await writeCommands(ctx, [{ kind: 'path', path: outline, fill: { paint: stroke.paint } }], state);
  }
  if (heads.length) await writeCommands(ctx, heads, state);
}

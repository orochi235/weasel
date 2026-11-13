import { joinPaths, type Path, type PolygonPath, splitByClosure, splitSubpaths } from '@weasel-js/geom';
import {
  type CommandPaint, type CommandStroke, dashPattern, dashPhase, isSolidPaint, type Stroke,
} from '@weasel-js/paint';
import { markerDrawCommands, resolveStrokeLengths } from '@weasel-js/renderer';
import { dashLength, insetPath, strokeInsets, strokeToPath, trimmedPath, trimmedRuns } from '@weasel-js/stroke';
import { solidColor } from './color';
import { type DrawState, type PageCtx, skip, writeCommands } from './drawCommands';
import { num } from './num';
import { pathOps } from './pathOps';

const CAPS = { butt: 0, round: 1, square: 2 } as const;
const JOINS = { miter: 0, round: 1, bevel: 2 } as const;

/** Whether PDF's own stroke operator draws this stroke as the renderer would. */
export function isNative(stroke: CommandStroke): boolean {
  if (stroke.align && stroke.align !== 'center') return false;
  return !(stroke.vertexWidths || stroke.nib || stroke.vertexColors);
}

/**
 * The line style operators for a native stroke; the caller sets its color.
 * `length` is the stroked path's, from `dashLength`, so a dash too fine for
 * it goes solid here as it does in the renderer.
 */
export function strokeStyleOps(ctx: PageCtx, stroke: CommandStroke, width: number, length?: number, phase = 0): void {
  const { out } = ctx;
  out.op('w', width);
  out.op('J', CAPS[stroke.cap ?? 'butt']);
  out.op('j', JOINS[stroke.join ?? 'miter']);
  // PDF refuses a limit below 1; the renderer bevels every corner under one, as a limit of 1 does.
  out.op('M', Math.max(1, stroke.miterLimit ?? 4));
  // PDF draws nothing for an all-zero dash and rejects a negative one; the renderer strokes both solid.
  // A non-finite one never gets here: no line is drawn for it.
  const dash = dashPattern(stroke.dash, length);
  if (dash === 'solid' || dash === 'non-finite') return;
  const places = out.places();
  const written = dash.map((d) => num(d, places));
  // Dashes too fine to write are all zero in PDF, which draws no line; the renderer draws them as good as solid.
  if (written.every((d) => d === '0')) return;
  // Wrapped into one cycle, as the renderer's dasher reads it; PDF has no rule for a negative phase.
  out.op('d', `[${written.join(' ')}]`, num(dashPhase(dash, phase + (stroke.dashOffset ?? 0)), places));
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
  const cut = trimmedPath(path, stroke.trim);
  // The renderer draws no line for a non-finite dash, and still draws its heads.
  if (!paint || !isSolidPaint(paint) || !cut || dashPattern(stroke.dash) === 'non-finite') return;
  const { rgb, alpha } = solidColor(paint, state);
  const { out } = ctx;
  out.op('q');
  out.op('gs', `/${ctx.resources.extGState(alpha, alpha)}`);
  out.op('RG', ...rgb);
  // The untrimmed length decides a dash too fine to draw, as it does in the renderer.
  const length = stroke.dash ? dashLength(path) : undefined;
  const insets = strokeInsets(stroke as Stroke, width);
  for (const run of trimmedRuns(cut, { dashed: stroke.dash !== undefined, byClosed: true })) {
    const shaft = run.fromClosed ? run.path : shaftOf(run.path, insets.start, insets.end);
    if (!shaft) continue;
    strokeStyleOps(ctx, stroke, width, length, run.dashPhase);
    pathOps(out, shaft, 'all');
    out.op('S');
  }
  out.op('Q');
}

/** `path` with each open subpath cut back for the heads the line stops short
 *  of, as the renderer's ribbon is; `null` when nothing of it is left. */
function shaftOf(path: Path, start: number, end: number): Path | null {
  if (!(start > 0) && !(end > 0)) return path;
  const subs = path.kind === 'polygon' ? splitSubpaths(path) : [path];
  const kept = subs.flatMap((sub) => {
    if (sub.kind !== 'polygon' || splitByClosure(sub).open === null) return [sub];
    return insetPath(sub, start, end) ?? [];
  });
  return kept.length === 0 ? null : kept.length === 1 ? kept[0] : joinPaths(kept as PolygonPath[]);
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
  if (isNative(stroke) && isSolidPaint(stroke.paint)) writeNative(ctx, path, stroke, state, width);
  else {
    if (stroke.vertexColors) skip(ctx, 'stroke vertexColors approximated by a single paint');
    heads = heads.filter((h) => h.stroke || h.fill?.paint !== stroke.paint);
    const outline = strokeToPath(path, stroke as Stroke);
    await writeCommands(ctx, [{ kind: 'path', path: outline, fill: { paint: stroke.paint } }], state);
  }
  if (heads.length) await writeCommands(ctx, heads, state);
}

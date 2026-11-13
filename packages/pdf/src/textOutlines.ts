import type { Path } from '@weasel-js/geom';
import { type CommandFill, type CommandStroke, fillHasInk, strokeHasInk } from '@weasel-js/paint';
import type { PathDrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import { glyphOutlineAt, type PlacedGlyph } from '@weasel-js/text';
import type { PageCtx } from './drawCommands';

/** Word breaks a reader copies and searches by: written as glyphs where the face has one, and never ink. */
export function isSpace(cp: number): boolean {
  return cp === 0x20 || cp === 0xa0;
}

export function codepointLabel(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function skipGlyph(ctx: PageCtx, g: PlacedGlyph, why: string): void {
  const { family, weight, style } = g.resolved.resolved;
  ctx.skipped.push({ kind: 'glyph', detail: `${codepointLabel(g.cp)} in ${family} ${weight} ${style} ${why}` });
}

/** A glyph with no outline: the source has none for it, or it threw, and this is the message. */
export interface NoOutline {
  threw?: string;
}

/** Records a glyph left out for having no outline: `why`, or what its font source threw. */
export function skipNoOutline(ctx: PageCtx, g: PlacedGlyph, none: NoOutline, why: string): void {
  skipGlyph(ctx, g, none.threw === undefined ? why : `has no outline: its font source threw "${none.threw}"`);
}

/** The glyph's outline where the renderer's outline tier places it, faked bold and oblique as it fakes them. */
export function placedOutline(ctx: PageCtx, g: PlacedGlyph, dx: number, dy: number): Path | NoOutline {
  const { family, weight, style } = g.resolved.resolved;
  let d: string | null;
  try {
    // A shaped code point draws its cluster's glyphs, not the one its code point maps to.
    d = g.shaped ? g.shaped.d : ctx.opts.fonts.outline(family, weight, style, g.cp);
  } catch (e) {
    return { threw: e instanceof Error ? e.message : String(e) };
  }
  if (d === null) return {};
  return glyphOutlineAt(d, g, dx, dy);
}

export function hasOutline(p: Path | NoOutline): p is Path {
  return 'kind' in p;
}

/** The glyph as a path command painted as its run paints it (or only stroked), or why there is no outline for it. */
export function outlineCommand(
  ctx: PageCtx,
  g: PlacedGlyph,
  cmd: TextDrawCommand,
  dx: number,
  dy: number,
  paint: 'all' | 'stroke' = 'all',
): PathDrawCommand | NoOutline {
  const path = placedOutline(ctx, g, dx, dy);
  if (!hasOutline(path)) return path;
  const run = cmd.runs[g.run];
  const out: PathDrawCommand = { kind: 'path', path };
  if (paint !== 'stroke' && fillHasInk(run.fill)) out.fill = run.fill as CommandFill;
  if (strokeHasInk(run.stroke)) {
    // The renderer strokes a glyph's outline with no heads, so none are drawn on it here either.
    const { markerStart: _s, markerMid: _m, markerEnd: _e, ...line } = run.stroke as CommandStroke;
    out.stroke = line;
  }
  return out;
}

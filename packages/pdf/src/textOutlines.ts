import { type Path, pathFromD, transformPath } from '@weasel-js/geom';
import { type CommandFill, type CommandStroke, fillHasInk, strokeHasInk } from '@weasel-js/paint';
import type { PathDrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import { emboldenGlyphD, type PlacedGlyph, SYNTHETIC_ITALIC_RADIANS } from '@weasel-js/text';
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

/** The glyph's outline where the renderer's outline tier places it, faked bold and oblique as it fakes them. */
export function placedOutline(ctx: PageCtx, g: PlacedGlyph, dx: number, dy: number): Path | null {
  const { family, weight, style } = g.resolved.resolved;
  let d: string | null;
  try {
    d = ctx.opts.fonts.outline(family, weight, style, g.cp);
  } catch {
    return null;
  }
  if (d === null) return null;
  const grown = emboldenGlyphD(d, g.resolved)?.d ?? d;
  const s = g.fontSize;
  // Em space is y down, so a point above the baseline has negative y and leans toward +x.
  const shear = g.resolved.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
  return transformPath(pathFromD(grown), [s, 0, -shear * s, s, g.x + dx, g.baselineY + dy]);
}

/** The glyph as a path command painted as its run paints it (or only stroked), or null when the source has no outline for it. */
export function outlineCommand(
  ctx: PageCtx,
  g: PlacedGlyph,
  cmd: TextDrawCommand,
  dx: number,
  dy: number,
  paint: 'all' | 'stroke' = 'all',
): PathDrawCommand | null {
  const path = placedOutline(ctx, g, dx, dy);
  if (!path) return null;
  const run = cmd.runs[g.run];
  const out: PathDrawCommand = { kind: 'path', path };
  if (paint !== 'stroke' && fillHasInk(run.fill)) out.fill = run.fill as CommandFill;
  if (strokeHasInk(run.stroke)) out.stroke = run.stroke as CommandStroke;
  return out;
}

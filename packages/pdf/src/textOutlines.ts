import { type Path, pathFromD, transformPath } from '@weasel-js/geom';
import { type CommandFill, type CommandStroke, fillHasInk, strokeHasInk } from '@weasel-js/paint';
import type { PathDrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import { emboldenGlyphD, type PlacedGlyph, SYNTHETIC_ITALIC_RADIANS } from '@weasel-js/text';
import type { PageCtx } from './drawCommands';

export function codepointLabel(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function skipGlyph(ctx: PageCtx, g: PlacedGlyph, why: string): void {
  const { family, weight, style } = g.resolved.resolved;
  ctx.skipped.push({ kind: 'glyph', detail: `${codepointLabel(g.cp)} in ${family} ${weight} ${style} ${why}` });
}

/** The glyph's outline where the renderer's outline tier places it, faked bold and oblique as it fakes them. */
function placedOutline(ctx: PageCtx, g: PlacedGlyph, dx: number, dy: number): Path | null {
  const { family, weight, style } = g.resolved.resolved;
  const d = ctx.opts.fonts.outline(family, weight, style, g.cp);
  if (d === null) return null;
  const grown = emboldenGlyphD(d, g.resolved)?.d ?? d;
  const s = g.fontSize;
  // Em space is y down, so a point above the baseline has negative y and leans toward +x.
  const shear = g.resolved.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
  return transformPath(pathFromD(grown), [s, 0, -shear * s, s, g.x + dx, g.baselineY + dy]);
}

/** The glyph as a path command painted as its run paints it, or null when the source has no outline for it. */
export function outlineCommand(
  ctx: PageCtx,
  g: PlacedGlyph,
  cmd: TextDrawCommand,
  dx: number,
  dy: number,
): PathDrawCommand | null {
  const path = placedOutline(ctx, g, dx, dy);
  if (!path) return null;
  const run = cmd.runs[g.run];
  const out: PathDrawCommand = { kind: 'path', path };
  if (fillHasInk(run.fill)) out.fill = run.fill as CommandFill;
  if (strokeHasInk(run.stroke)) out.stroke = run.stroke as CommandStroke;
  return out;
}

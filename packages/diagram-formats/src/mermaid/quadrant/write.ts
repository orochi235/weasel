/** A plot page holding a quadrant chart as Mermaid `quadrantChart` text. */
import { rgbaToHex, tryParseColor } from '@weasel-js/paint';
import { quadrantClassEntries, type QuadrantAxis, type QuadrantPointStyle } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { mermaidQuoted, oneLine } from '../common/text';

/** A first word that would read as a statement of its own, or a comment, rather than a point. */
const STATEMENT = /^(?:(?:title|x-axis|y-axis|quadrant-[1-4]|classDef)(?:\s|$)|%%|acc(?:Title|Descr))/;

/** Text bare where Mermaid reads it back the same, else as {@link mermaidQuoted} writes it. */
const text = (s: string): string =>
  /^[^\s"].*$/.test(s) && !/[:[\]"]|-->|\s$/.test(s) && !STATEMENT.test(s) ? s : mermaidQuoted(s);

function axisLine(name: 'x' | 'y', axis: QuadrantAxis | undefined, warnings: Warnings): string | null {
  if (axis?.low === undefined) {
    if (axis?.high !== undefined) warnings.add('Mermaid holds an axis\'s high end only with its low end; it was dropped.');
    return null;
  }
  return `${name}-axis ${text(axis.low)}${axis.high !== undefined ? ` --> ${text(axis.high)}` : ''}`;
}

/** A color as one style value: as given where it holds no comma or space, which divide a style, else in hex. `null`,
 *  with a warning, for one with no hex spelling. */
function colorValue(color: string | undefined, warnings: Warnings): string | null {
  if (color === undefined) return null;
  if (/^[^\s,]+$/.test(color)) return color;
  const rgba = tryParseColor(color.trim());
  if (rgba !== null) return rgbaToHex(rgba);
  warnings.add('Mermaid point colors are one word; colors it cannot read as one were dropped.');
  return null;
}

/** A style's size as written, `null`, with a warning, when it is not a finite number. */
function sizeValue(n: number | undefined, warnings: Warnings): number | null {
  if (n === undefined) return null;
  if (Number.isFinite(n)) return n;
  warnings.add('Mermaid point radii and stroke widths are numbers; others were dropped.');
  return null;
}

function styleText(style: QuadrantPointStyle | undefined, warnings: Warnings): string {
  if (style === undefined) return '';
  const radius = sizeValue(style.radius, warnings);
  const color = colorValue(style.color, warnings);
  const stroke = colorValue(style.strokeColor, warnings);
  const width = sizeValue(style.strokeWidth, warnings);
  return [
    radius !== null ? `radius: ${radius}` : null,
    color !== null ? `color: ${color}` : null,
    stroke !== null ? `stroke-color: ${stroke}` : null,
    width !== null ? `stroke-width: ${width}px` : null,
  ].filter((p) => p !== null).join(', ');
}

/** Writes `page`'s quadrant chart as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidQuadrant(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'quadrant') throw new Error(`Mermaid writes this chart as a quadrant chart only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const lines = ['quadrantChart'];
  const title = data.title === undefined ? '' : oneLine(data.title, 'quadrant chart', (m) => warnings.add(m)).trim();
  if (title) lines.push(`  title ${title}`);
  for (const axis of ['x', 'y'] as const) {
    const line = axisLine(axis, data[axis], warnings);
    if (line !== null) lines.push(`  ${line}`);
  }
  data.quadrants?.forEach((label, i) => {
    if (label) lines.push(`  quadrant-${i + 1} ${text(label)}`);
  });
  for (const p of data.points) {
    const outside = !(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    if (outside) warnings.add('Mermaid holds points from 0 to 1 only; others were moved to the nearest edge.');
    const unit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
    const style = styleText(p.style, warnings);
    lines.push(`  ${text(p.name)}${p.className !== undefined ? `:::${p.className}` : ''}: [${unit(p.x)}, ${unit(p.y)}]${style ? ` ${style}` : ''}`);
  }
  for (const [name, style] of quadrantClassEntries(data)) lines.push(`  classDef ${name} ${styleText(style, warnings)}`);
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}

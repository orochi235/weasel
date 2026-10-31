/** A plot page holding a quadrant chart as Mermaid `quadrantChart` text. */
import type { QuadrantAxis, QuadrantPointStyle } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';

/** Text bare where Mermaid reads it back the same, else in double quotes with a quote inside written `#quot;`. */
const text = (s: string): string => (/^[^\s"].*$/.test(s) && !/[:[\]"]|-->|\s$/.test(s) ? s : `"${s.replace(/"/g, '#quot;')}"`);

function axisLine(name: 'x' | 'y', axis: QuadrantAxis | undefined, warnings: Warnings): string | null {
  if (axis?.low === undefined) {
    if (axis?.high !== undefined) warnings.add('Mermaid holds an axis\'s high end only with its low end; it was dropped.');
    return null;
  }
  return `${name}-axis ${text(axis.low)}${axis.high !== undefined ? ` --> ${text(axis.high)}` : ''}`;
}

function styleText(style: QuadrantPointStyle | undefined): string {
  if (style === undefined) return '';
  return [
    style.radius !== undefined ? `radius: ${style.radius}` : null,
    style.color !== undefined ? `color: ${style.color}` : null,
    style.strokeColor !== undefined ? `stroke-color: ${style.strokeColor}` : null,
    style.strokeWidth !== undefined ? `stroke-width: ${style.strokeWidth}px` : null,
  ].filter((p) => p !== null).join(', ');
}

/** Writes `page`'s quadrant chart as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidQuadrant(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'quadrant') throw new Error(`Mermaid writes this chart as a quadrant chart only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const lines = ['quadrantChart'];
  if (data.title?.trim()) lines.push(`  title ${data.title.trim()}`);
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
    const style = styleText(p.style);
    lines.push(`  ${text(p.name)}${p.className !== undefined ? `:::${p.className}` : ''}: [${unit(p.x)}, ${unit(p.y)}]${style ? ` ${style}` : ''}`);
  }
  for (const [name, style] of Object.entries(data.classes ?? {})) lines.push(`  classDef ${name} ${styleText(style)}`);
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}

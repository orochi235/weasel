/** A plot page holding a timeline as Mermaid `timeline` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineOpening, spelledLine } from '../common/text';


/** The label a period with none is written with, since a line with no label adds events to the period above. */
const UNTITLED = '(untitled)';


/** Writes `page`'s timeline as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidTimeline(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'timeline') throw new Error(`Mermaid writes this chart as a timeline only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const text = (s: string) => spelledLine(s, 'timeline', (m) => warnings.add(m));
  const lines = ['timeline'];
  if (data.title !== undefined) lines.push(`  title ${text(data.title)}`);
  let named = false;
  data.sections.forEach((section, i) => {
    if (section.name !== undefined) {
      lines.push(`  section ${text(section.name)}`);
      named = true;
    } else if (i > 0) {
      warnings.add('Mermaid holds no unnamed section after the first; its periods were written into the section before it.');
    }
    const indent = named ? '    ' : '  ';
    for (const period of section.periods) {
      const blank = period.label.trim() === '';
      if (blank) {
        warnings.add(`Mermaid reads a line with no period as more events for the period above it; periods with no label were labeled "${UNTITLED}".`);
      }
      const events = period.events.filter((e) => e.trim() !== '');
      if (events.length < period.events.length) warnings.add('Mermaid holds no empty events; they were dropped.');
      lines.push(`${indent}${[blank ? UNTITLED : lineOpening(text(period.label).trim(), ['title', 'section']), ...events.map(text)].join(' : ')}`);
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}

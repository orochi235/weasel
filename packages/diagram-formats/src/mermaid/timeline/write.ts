/** A plot page holding a timeline as Mermaid `timeline` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';

/** `s` on one line, the colon Mermaid splits on written as `#58;`. */
function timelineText(s: string, warnings: Warnings): string {
  if (/[\r\n]/.test(s)) warnings.add('Mermaid timeline text holds one line; line breaks were written as spaces.');
  return s.replace(/\s*[\r\n]+\s*/g, ' ').replace(/:/g, '#58;');
}

/** Writes `page`'s timeline as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidTimeline(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'timeline') throw new Error(`Mermaid writes this chart as a timeline only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const text = (s: string) => timelineText(s, warnings);
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
      const events = period.events.filter((e) => e.trim() !== '');
      if (events.length < period.events.length) warnings.add('Mermaid holds no empty events; they were dropped.');
      lines.push(`${indent}${[text(period.label), ...events.map(text)].join(' : ')}`);
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}

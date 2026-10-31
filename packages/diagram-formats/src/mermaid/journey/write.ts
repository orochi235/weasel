/** A plot page holding a user journey as Mermaid `journey` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';

/** Writes `page`'s journey as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidJourney(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'journey') throw new Error(`Mermaid writes this chart as a journey only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const plain = (s: string, syntax: RegExp): string => {
    if (!syntax.test(s)) return s.trim();
    warnings.add('Mermaid journey text holds no "#", ";" or ":" (nor "," in an actor); they were dropped.');
    return s.replace(syntax, '').trim();
  };
  const lines = ['journey'];
  if (data.title?.trim()) lines.push(`  title ${plain(data.title, /[#;]/g)}`);
  data.sections.forEach((section, s) => {
    if (section.name !== undefined && section.name.trim() !== '') lines.push(`  section ${plain(section.name, /[#:;]/g)}`);
    else if (s > 0) warnings.add('Mermaid holds a section with no name only first; its steps were written under the section before.');
    for (const t of section.tasks) {
      const score = Math.min(5, Math.max(1, Math.round(Number.isFinite(t.score) ? t.score : 1)));
      if (score !== t.score) warnings.add('Mermaid scores are whole numbers from 1 to 5; others were rounded into that range.');
      const actors = t.actors.map((a) => plain(a, /[#:;,]/g)).filter((a) => a !== '');
      lines.push(`    ${plain(t.name, /[#:;]/g)}: ${score}${actors.length > 0 ? `: ${actors.join(', ')}` : ''}`);
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}

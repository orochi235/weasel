/** A plot page holding a user journey as Mermaid `journey` text. */
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { oneLine } from '../common/text';

/** A step's name as it opens its line: `(untitled)` for none, since Mermaid reads a step only with a name, a leading
 *  `%%` dropped, which would make the line a comment, and `null` for a name whose first word is `title` or `section`,
 *  which Mermaid reads as that statement. */
function stepName(name: string, warn: (m: string) => void): string | null {
  let out = name;
  if (out.startsWith('%%')) {
    warn('Mermaid reads a line opening with "%%" as a comment; a leading "%%" in step names was dropped.');
    while (out.startsWith('%%')) out = out.replace(/^%+\s*/, '');
  }
  if (/^(?:title|section)(?:\s|$)/.test(out)) {
    warn('Mermaid reads a step named "title …" or "section …" as that statement; those steps were dropped.');
    return null;
  }
  if (out !== '') return out;
  warn('Mermaid reads a step only with a name; steps with none were written as "(untitled)".');
  return '(untitled)';
}

/** Writes `page`'s journey as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidJourney(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'journey') throw new Error(`Mermaid writes this chart as a journey only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const plain = (text: string, syntax: RegExp): string => {
    const s = oneLine(text, 'journey', (m) => warnings.add(m));
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
      const name = stepName(plain(t.name, /[#:;]/g), (m) => warnings.add(m));
      if (name === null) continue;
      lines.push(`    ${name}: ${score}${actors.length > 0 ? `: ${actors.join(', ')}` : ''}`);
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}

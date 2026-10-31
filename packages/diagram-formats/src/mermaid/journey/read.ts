/** A Mermaid user journey as a one-page document holding a plot page. */
import type { JourneyData, JourneyTask } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf, type Statement } from '../common/lines';

/** The page a journey is read onto. */
export const JOURNEY_PAGE = { width: 800, height: 450 } as const;

/** `Name: 5: Actor1, Actor2` as a step. Throws, naming the line, on a line that is not one or a score that is not a
 *  whole number from 1 to 5. */
function taskOf(s: Statement): JourneyTask {
  const [name, score, actors, ...more] = s.text.split(':').map((p) => p.trim());
  if (score === undefined || more.length > 0 || name === '') throw lineError('Mermaid', s.line, `"${s.text}" is not a journey statement`);
  if (!/^[+-]?\d+$/.test(score) || Number(score) < 1 || Number(score) > 5) {
    throw lineError('Mermaid', s.line, `a step's score is a whole number from 1 to 5, and "${score}" is not`);
  }
  return { name: name!, score: Number(score), actors: (actors ?? '').split(',').map((a) => a.trim()).filter((a) => a !== '') };
}

/** Reads a Mermaid `journey`. Throws, naming the line, on text that is not one. */
export function readMermaidJourney(text: string): ImportResult {
  const src = statementsOf(text);
  if (src.header.text !== 'journey') throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a journey header`);
  const warnings = new Warnings();
  let title: string | undefined;
  const sections: { name?: string; tasks: JourneyTask[] }[] = [];
  for (const s of src.body) {
    const keyword = /^(title|section)(?:\s+(.*))?$/.exec(s.text);
    if (keyword?.[1] === 'title') title = keyword[2]?.trim() || undefined;
    else if (keyword?.[1] === 'section') {
      const name = keyword[2]?.trim();
      sections.push({ ...(name ? { name } : {}), tasks: [] });
    } else {
      if (sections.length === 0) sections.push({ tasks: [] });
      sections[sections.length - 1]!.tasks.push(taskOf(s));
    }
  }
  const named = pageNameOf(src, warnings);
  if (title !== undefined && src.title !== undefined && src.title !== title) warnings.add('The front matter title was dropped; the chart is titled by its own.');
  title ??= src.title;
  const data: JourneyData = { kind: 'journey', ...(title !== undefined ? { title } : {}), sections };
  const name = title ?? named;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(name !== undefined ? { name } : {}), ...JOURNEY_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}

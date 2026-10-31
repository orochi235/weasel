/** A Mermaid timeline as a one-page document holding a plot page. */
import type { TimelineData, TimelinePeriod, TimelineSection } from '@weasel-js/plot';
import type { ImportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf, statementsOf } from '../common/lines';

/** The page a timeline is read onto. */
export const TIMELINE_PAGE = { width: 900, height: 500 } as const;

/** Text as a timeline writes it, `#58;` read back as the colon Mermaid splits on. */
export const timelineText = (s: string): string => s.trim().replace(/#58;/g, ':');

/** Reads a Mermaid `timeline`. Throws, naming the line, on text that is not one. */
export function readMermaidTimeline(text: string): ImportResult {
  const src = statementsOf(text);
  const warnings = new Warnings();
  const header = /^timeline(?:\s+(\S+))?$/.exec(src.header.text);
  if (header === null) throw lineError('Mermaid', src.header.line, `"${src.header.text}" is not a timeline header`);
  if (header[1] !== undefined) warnings.add('The timeline\'s direction was dropped; it is drawn left to right.');
  let title: string | undefined;
  const sections: { name?: string; periods: TimelinePeriod[] }[] = [{ periods: [] }];
  let last: TimelinePeriod | null = null;
  for (const s of src.body) {
    const keyword = /^(title|section)(?:\s+(.*))?$/.exec(s.text);
    if (keyword?.[1] === 'title') {
      title = timelineText(keyword[2] ?? '');
      continue;
    }
    if (keyword?.[1] === 'section') {
      sections.push({ name: timelineText(keyword[2] ?? ''), periods: [] });
      last = null;
      continue;
    }
    const [label, ...events] = s.text.split(':').map(timelineText);
    const said = events.filter((e) => e !== '');
    if (label === '') {
      if (last === null) throw lineError('Mermaid', s.line, 'an event with no period above it');
      last.events = [...last.events, ...said];
      continue;
    }
    last = { label: label!, events: said };
    sections[sections.length - 1]!.periods.push(last);
  }
  const name = pageNameOf(src, warnings);
  if (title !== undefined && src.title !== undefined && title !== src.title) {
    warnings.add('The front matter title was dropped; the chart is named by its title statement.');
  }
  const chartTitle = title || src.title;
  const kept: TimelineSection[] = sections.filter((sec, i) => i > 0 || sec.periods.length > 0);
  const data: TimelineData = { kind: 'timeline', ...(chartTitle ? { title: chartTitle } : {}), sections: kept };
  const pageName = chartTitle || name;
  const page: PlotPage = { kind: 'plot', id: 'page-1', ...(pageName ? { name: pageName } : {}), ...TIMELINE_PAGE, data };
  return { document: { pages: [page] }, warnings: warnings.all() };
}

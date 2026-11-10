import { describe, expect, it } from 'vitest';
import type { TimelineData } from '@weasel-js/plot';
import type { PlotPage } from '../../document';
import { readMermaidTimeline } from './read';
import { writeMermaidTimeline } from './write';

const pageOf = (data: TimelineData): PlotPage => ({ kind: 'plot', id: 'p', width: 900, height: 500, data });
const back = (data: TimelineData) => (readMermaidTimeline(writeMermaidTimeline(pageOf(data)).text).document.pages[0] as PlotPage).data as TimelineData;

describe('Mermaid timeline, shrunk counterexamples', () => {
  it('drops, with a warning, a period with no label rather than writing a line that reads as more events or fails', () => {
    const data: TimelineData = { kind: 'timeline', sections: [{ name: '', periods: [{ label: '', events: ['a'] }, { label: 'b', events: [] }] }] };
    expect(writeMermaidTimeline(pageOf(data)).warnings).toContain(
      'Mermaid reads a line with no period as more events for the period above it; periods with no label were dropped.',
    );
    expect(back(data).sections.map((s) => s.periods.map((p) => p.label))).toEqual([['b']]);
  });

  it('keeps a "#58;" written as text, and a period labeled like a keyword or a comment', () => {
    const data: TimelineData = {
      kind: 'timeline',
      sections: [{ name: 's', periods: [{ label: '#58;', events: ['#35;'] }, { label: 'title x', events: [] }, { label: '%%y', events: ['e'] }] }],
    };
    expect(back(data).sections[0]!.periods).toEqual([{ label: '#58;', events: ['#35;'] }, { label: 'title x', events: [] }, { label: '%%y', events: ['e'] }]);
  });
});

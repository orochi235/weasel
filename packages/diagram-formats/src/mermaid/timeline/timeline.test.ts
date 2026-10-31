import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidTimeline } from './read';
import { writeMermaidTimeline } from './write';

const FIXTURES = ['industry.mmd', 'social.mmd'];
const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'timeline', name), 'utf8');
const plotOf = (text: string) => readMermaidTimeline(text).document.pages[0] as PlotPage;

describe('reading a Mermaid timeline', () => {
  it('reads periods, their events and continuation lines onto one plot page', () => {
    const { document, warnings } = readMermaidTimeline(fixture('social.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'History of Social Media Platform', width: 900, height: 500 });
    expect(page.data).toEqual({
      kind: 'timeline',
      title: 'History of Social Media Platform',
      sections: [{
        periods: [
          { label: '2002', events: ['LinkedIn'] },
          { label: '2004', events: ['Facebook', 'Google'] },
          { label: '2005', events: ['YouTube'] },
          { label: '2006', events: ['Twitter', 'Tumblr'] },
          { label: '2007', events: [] },
        ],
      }],
    });
    expect(warnings).toEqual([]);
  });

  it('reads sections, keeping commas inside an event', () => {
    const { document, warnings } = readMermaidTimeline(fixture('industry.mmd'));
    const data = (document.pages[0] as PlotPage).data;
    expect(data).toMatchObject({ kind: 'timeline', title: 'Timeline of Industrial Revolution' });
    if (data.kind !== 'timeline') throw new Error('not a timeline');
    expect(data.sections.map((s) => s.name)).toEqual(['17th-20th century', '21st century']);
    expect(data.sections[0]!.periods[0]).toEqual({ label: 'Industry 1.0', events: ['Machinery, Water power, Steam <br>power'] });
    expect(warnings).toEqual(['The front matter title was dropped; the chart is named by its title statement.']);
  });

  it('takes the front matter title where there is no title statement, and warns of what it drops', () => {
    expect(plotOf('---\ntitle: Up top\n---\ntimeline\n  2001 : A').data).toMatchObject({ title: 'Up top' });
    const { warnings } = readMermaidTimeline('%%{init: {}}%%\ntimeline LR\n  accDescr: about\n  2001 : A');
    expect(warnings).toEqual([
      'The timeline\'s direction was dropped; it is drawn left to right.',
      'Mermaid configuration directives were dropped.',
      'Mermaid accessible descriptions were dropped.',
    ]);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidTimeline('timeline\n\n  : orphan')).toThrow('Mermaid, line 3: an event with no period above it');
    expect(() => readMermaidTimeline('timeline\n  section A\n  : orphan')).toThrow(/line 3: an event with no period above it/);
    expect(() => readMermaidTimeline('timelines\n  2001')).toThrow(/line 1: "timelines" is not a timeline header/);
  });
});

describe('writing a Mermaid timeline', () => {
  it('round-trips each fixture', () => {
    for (const name of FIXTURES) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidTimeline(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes each period on one line, its events after colons, under its section', () => {
    expect(writeMermaidTimeline(plotOf(fixture('industry.mmd'))).text).toBe([
      'timeline',
      '  title Timeline of Industrial Revolution',
      '  section 17th-20th century',
      '    Industry 1.0 : Machinery, Water power, Steam <br>power',
      '    Industry 2.0 : Electricity, Internal combustion engine, Mass production',
      '    Industry 3.0 : Electronics, Computers, Automation',
      '  section 21st century',
      '    Industry 4.0 : Internet, Robotics, Internet of Things',
      '    Industry 5.0 : Artificial intelligence, Big data, 3D printing',
      '',
    ].join('\n'));
  });

  it('writes a colon so it reads back, and warns on what Mermaid cannot hold', () => {
    const page: PlotPage = {
      kind: 'plot', id: 'p', width: 10, height: 10,
      data: {
        kind: 'timeline',
        sections: [
          { name: 'A', periods: [{ label: '9:00', events: ['two\nlines', ''] }] },
          { periods: [{ label: '10:00', events: [] }] },
        ],
      },
    };
    const { text, warnings } = writeMermaidTimeline(page);
    expect(text).toBe('timeline\n  section A\n    9#58;00 : two lines\n    10#58;00\n');
    expect(plotOf(text).data).toEqual({
      kind: 'timeline', sections: [{ name: 'A', periods: [{ label: '9:00', events: ['two lines'] }, { label: '10:00', events: [] }] }],
    });
    expect(warnings).toEqual([
      'Mermaid holds no empty events; they were dropped.',
      'Mermaid timeline text holds one line; line breaks were written as spaces.',
      'Mermaid holds no unnamed section after the first; its periods were written into the section before it.',
    ]);
    expect(() => writeMermaidTimeline({ ...page, data: { kind: 'pie', slices: [] } as never })).toThrow(/as a timeline only/);
  });
});

describe('the Mermaid format', () => {
  it('reads a timeline by its header and writes a plot page as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('social.mmd'));
    expect(document.pages[0]!.kind).toBe('plot');
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('timeline\n')).toBe(true);
  });
});

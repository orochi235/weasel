import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidJourney } from './read';
import { writeMermaidJourney } from './write';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'journey', name), 'utf8');
const plotOf = (text: string) => readMermaidJourney(text).document.pages[0] as PlotPage;

describe('reading a Mermaid journey', () => {
  it('reads its title, sections and scored steps onto one plot page', () => {
    const { document, warnings } = readMermaidJourney(fixture('working-day.mmd'));
    expect(document.pages[0]).toMatchObject({ kind: 'plot', id: 'page-1', name: 'My working day', width: 800, height: 450 });
    expect((document.pages[0] as PlotPage).data).toEqual({
      kind: 'journey',
      title: 'My working day',
      sections: [
        {
          name: 'Go to work',
          tasks: [
            { name: 'Make tea', score: 5, actors: ['Me'] },
            { name: 'Go upstairs', score: 3, actors: ['Me'] },
            { name: 'Do work', score: 1, actors: ['Me', 'Cat'] },
          ],
        },
        { name: 'Go home', tasks: [{ name: 'Go downstairs', score: 5, actors: ['Me'] }, { name: 'Sit down', score: 5, actors: ['Me'] }] },
      ],
    });
    expect(warnings).toEqual([]);
  });

  it('reads the front matter title, steps before any section, and a step with no actors', () => {
    expect(plotOf(fixture('checkout.mmd')).data).toEqual({
      kind: 'journey',
      title: 'Checkout',
      sections: [
        { tasks: [{ name: 'Open the site', score: 4, actors: ['Shopper'] }] },
        { name: 'Browse', tasks: [{ name: 'Search', score: 3, actors: ['Shopper', 'Search service'] }, { name: 'Read reviews', score: 4, actors: [] }] },
        { name: 'Pay', tasks: [{ name: 'Enter card', score: 2, actors: ['Shopper', 'Payments'] }, { name: 'Confirm', score: 5, actors: ['Shopper'] }] },
      ],
    });
  });

  it('warns on what it drops', () => {
    const { warnings } = readMermaidJourney('---\ntitle: Front\n---\n%%{init: {}}%%\njourney\n  title Own\n  A: 3');
    expect(warnings).toEqual(['Mermaid configuration directives were dropped.', 'The front matter title was dropped; the chart is titled by its own.']);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidJourney('journey\n  A: 6: Me')).toThrow('Mermaid, line 2: a step\'s score is a whole number from 1 to 5, and "6" is not');
    expect(() => readMermaidJourney('journey\n\n  A: 2.5')).toThrow('Mermaid, line 3: a step\'s score is a whole number from 1 to 5, and "2.5" is not');
    expect(() => readMermaidJourney('journey\n  A: ok: Me')).toThrow(/line 2: a step's score/);
    expect(() => readMermaidJourney('journey\n  Just a name')).toThrow('Mermaid, line 2: "Just a name" is not a journey statement');
    expect(() => readMermaidJourney('journey LR')).toThrow('Mermaid, line 1: "journey LR" is not a journey header');
  });
});

describe('writing a Mermaid journey', () => {
  it('round-trips each fixture', () => {
    for (const name of ['working-day.mmd', 'checkout.mmd']) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidJourney(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes sections and indented steps', () => {
    expect(writeMermaidJourney(plotOf(fixture('checkout.mmd'))).text).toBe([
      'journey',
      '  title Checkout',
      '    Open the site: 4: Shopper',
      '  section Browse',
      '    Search: 3: Shopper, Search service',
      '    Read reviews: 4',
      '  section Pay',
      '    Enter card: 2: Shopper, Payments',
      '    Confirm: 5: Shopper',
      '',
    ].join('\n'));
  });

  it('warns on what Mermaid cannot hold, and throws on another kind of chart', () => {
    const page: PlotPage = {
      kind: 'plot', id: 'p', width: 1, height: 1,
      data: { kind: 'journey', sections: [{ name: 'A', tasks: [] }, { tasks: [{ name: 'x: y', score: 7, actors: ['a,b'] }] }] },
    };
    const { text, warnings } = writeMermaidJourney(page);
    expect(text).toBe('journey\n  section A\n    x y: 5: ab\n');
    expect(warnings).toEqual([
      'Mermaid holds a section with no name only first; its steps were written under the section before.',
      'Mermaid scores are whole numbers from 1 to 5; others were rounded into that range.',
      'Mermaid journey text holds no "#", ";" or ":" (nor "," in an actor); they were dropped.',
    ]);
    expect(() => writeMermaidJourney({ ...page, data: { kind: 'pie', slices: [] } })).toThrow(/as a journey only; the page holds a pie/);
  });
});

describe('the Mermaid format', () => {
  it('reads a journey by its header and writes it back as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('working-day.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('journey');
    expect(DIAGRAM_MERMAID.detect(fixture('checkout.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('journey\n')).toBe(true);
  });
});

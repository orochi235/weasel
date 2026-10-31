import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidXychart } from './read';
import { writeMermaidXychart } from './write';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'xychart', name), 'utf8');
const plotOf = (text: string) => readMermaidXychart(text).document.pages[0] as PlotPage;

describe('reading a Mermaid xychart', () => {
  it('reads its title, axes and series onto one plot page', () => {
    const { document, warnings } = readMermaidXychart(fixture('sales.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'Sales Revenue', width: 800, height: 500 });
    expect(page.data).toEqual({
      kind: 'xychart',
      title: 'Sales Revenue',
      x: { kind: 'band', title: 'Month', categories: ['jan', 'feb', 'mar 1', 'apr'] },
      y: { title: 'Revenue (in $)', min: 4000, max: 11000 },
      series: [
        { kind: 'bar', values: [5000, 6000, 7500, 8200] },
        { kind: 'line', name: 'Trend', values: [5000, 6000, 7500, 8200] },
      ],
    });
    expect(warnings).toEqual(['Mermaid front matter other than the title was dropped.']);
  });

  it('reads a horizontal chart over a range, and the front matter title where there is no other', () => {
    expect(plotOf(fixture('range.mmd')).data).toEqual({
      kind: 'xychart', orientation: 'horizontal', x: { kind: 'range', min: 1, max: 10 }, y: { title: 'Score' },
      series: [{ kind: 'line', values: [1.5, -2, 30] }],
    });
    expect(plotOf('---\ntitle: Up top\n---\nxychart-beta\n  bar [1]').data.title).toBe('Up top');
  });

  it('warns on what it drops: directives, accessibility text, values past the last category', () => {
    const { warnings } = readMermaidXychart('%%{init: {}}%%\nxychart-beta\n  accTitle: A\n  accDescr {\n  long\n  }\n  x-axis [a]\n  bar [1, 2]');
    expect(warnings).toEqual([
      'Mermaid configuration directives were dropped.',
      'The chart\'s accTitle was dropped.',
      'The chart\'s accDescr was dropped.',
      '1 value(s) past the last category are not drawn.',
    ]);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidXychart('xychart-beta\n  pie [1]')).toThrow('Mermaid, line 2: "pie" is not an xychart statement');
    expect(() => readMermaidXychart('xychart-beta\n\n  bar [1, x]')).toThrow('Mermaid, line 3: "x" is not a number');
    expect(() => readMermaidXychart('xychart-beta\n  x-axis [a, b')).toThrow(/line 2: a category list with no closing/);
    expect(() => readMermaidXychart('xychart-beta\n  y-axis [a]')).toThrow(/line 2: the y axis takes a range/);
    expect(() => readMermaidXychart('flowchart TD\n  A')).toThrow(/line 1: "flowchart TD" is not an xychart header/);
  });
});

describe('writing a Mermaid xychart', () => {
  it('round-trips each fixture', () => {
    for (const name of ['sales.mmd', 'range.mmd']) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidXychart(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes plainly, quoting what needs it', () => {
    const page = plotOf(fixture('sales.mmd'));
    expect(writeMermaidXychart(page).text).toBe([
      'xychart-beta',
      '  title "Sales Revenue"',
      '  x-axis "Month" [jan, feb, "mar 1", apr]',
      '  y-axis "Revenue (in $)" 4000 --> 11000',
      '  bar [5000, 6000, 7500, 8200]',
      '  line "Trend" [5000, 6000, 7500, 8200]',
      '',
    ].join('\n'));
    const quoted = { ...page, data: { ...page.data, title: 'Say "hi"' } };
    expect(plotOf(writeMermaidXychart(quoted).text).data.title).toBe('Say "hi"');
  });

  it('warns on what Mermaid cannot hold', () => {
    const page: PlotPage = { kind: 'plot', id: 'p', width: 10, height: 10, data: { kind: 'xychart', y: { min: 0 }, series: [{ kind: 'bar', values: [Number.NaN] }] } };
    const { text, warnings } = writeMermaidXychart(page);
    expect(text).toBe('xychart-beta\n  bar [0]\n');
    expect(warnings).toEqual([
      'Mermaid holds both ends of the y axis or neither; its one end was dropped.',
      'Mermaid holds no missing values; they were written as 0.',
    ]);
  });
});

describe('the Mermaid format', () => {
  it('reads an xychart by its header and writes a plot page as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('sales.mmd'));
    expect(document.pages[0]!.kind).toBe('plot');
    expect(DIAGRAM_MERMAID.detect(fixture('range.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('xychart-beta\n')).toBe(true);
    expect(DIAGRAM_MERMAID.kinds).toContain('plot');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidPie } from './read';
import { writeMermaidPie } from './write';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'pie', name), 'utf8');
const plotOf = (text: string) => readMermaidPie(text).document.pages[0] as PlotPage;

describe('reading a Mermaid pie', () => {
  it('reads its header\'s showData and title and each slice onto one plot page', () => {
    const { document, warnings } = readMermaidPie(fixture('elements.mmd'));
    expect(document.pages[0]).toMatchObject({ kind: 'plot', id: 'page-1', name: 'Key elements in Product X', width: 640, height: 400 });
    expect((document.pages[0] as PlotPage).data).toEqual({
      kind: 'pie',
      title: 'Key elements in Product X',
      showData: true,
      slices: [
        { label: 'Calcium', value: 42.96 },
        { label: 'Potassium', value: 50.05 },
        { label: 'Magnesium', value: 10.01 },
        { label: 'Iron', value: 5 },
      ],
    });
    expect(warnings).toEqual([]);
  });

  it('reads a title on its own line, single-quoted labels and zeros', () => {
    expect(plotOf(fixture('pets.mmd')).data).toEqual({
      kind: 'pie',
      title: 'Pets adopted by volunteers',
      slices: [
        { label: 'Dogs', value: 386 }, { label: 'Cats', value: 85 }, { label: 'Rats', value: 15 }, { label: 'Ferrets', value: 0 },
      ],
    });
    expect(plotOf('---\ntitle: Up top\n---\npie\n  "a" : 1').data).toEqual({ kind: 'pie', title: 'Up top', slices: [{ label: 'a', value: 1 }] });
  });

  it('warns on what it drops: directives, a repeated label, a front matter title the chart overrides', () => {
    const { document, warnings } = readMermaidPie('---\ntitle: Front\n---\n%%{init: {}}%%\npie title Own\n  "a" : 1\n  "a" : 2\n  "b" : 3');
    expect((document.pages[0] as PlotPage).data).toEqual({ kind: 'pie', title: 'Own', slices: [{ label: 'a', value: 1 }, { label: 'b', value: 3 }] });
    expect(warnings).toEqual([
      'Mermaid keeps the first of slices sharing a label; the others were dropped: a.',
      'Mermaid configuration directives were dropped.',
      'The front matter title was dropped; the chart is titled by its own.',
    ]);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidPie('pie\n  "a" : -1')).toThrow('Mermaid, line 2: a slice\'s value must not be negative, and -1 is');
    expect(() => readMermaidPie('pie\n\n  "a" : lots')).toThrow('Mermaid, line 3: "lots" is not a number');
    expect(() => readMermaidPie('pie\n  a : 1')).toThrow('Mermaid, line 2: "a : 1" is not a pie slice');
    expect(() => readMermaidPie('pie donut\n  "a" : 1')).toThrow('Mermaid, line 1: "pie donut" is not a pie header');
  });
});

describe('writing a Mermaid pie', () => {
  it('round-trips each fixture', () => {
    for (const name of ['elements.mmd', 'pets.mmd']) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidPie(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes its title and showData on the header and each slice quoted', () => {
    expect(writeMermaidPie(plotOf(fixture('elements.mmd'))).text).toBe([
      'pie showData title Key elements in Product X',
      '  "Calcium" : 42.96',
      '  "Potassium" : 50.05',
      '  "Magnesium" : 10.01',
      '  "Iron" : 5',
      '',
    ].join('\n'));
    const quote: PlotPage = { kind: 'plot', id: 'p', width: 1, height: 1, data: { kind: 'pie', slices: [{ label: 'Say "hi"', value: 1 }] } };
    expect(plotOf(writeMermaidPie(quote).text).data).toEqual(quote.data);
  });

  it('warns on what Mermaid cannot hold, and throws on another kind of chart', () => {
    const page: PlotPage = {
      kind: 'plot', id: 'p', width: 1, height: 1,
      data: { kind: 'pie', slices: [{ label: 'a', value: -2 }, { label: 'a', value: Number.NaN }] },
    };
    const { text, warnings } = writeMermaidPie(page);
    expect(text).toBe('pie\n  "a" : 0\n  "a" : 0\n');
    expect(warnings).toEqual([
      'Mermaid holds only non-negative values; others were written as 0.',
      'Mermaid reads only the first of slices sharing a label.',
    ]);
    expect(() => writeMermaidPie({ ...page, data: { kind: 'xychart', series: [] } })).toThrow(/as a pie only; the page holds a xychart/);
  });
});

describe('the Mermaid format', () => {
  it('reads a pie by its header and writes it back as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('elements.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('pie');
    expect(DIAGRAM_MERMAID.detect(fixture('pets.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('pie showData title')).toBe(true);
  });
});

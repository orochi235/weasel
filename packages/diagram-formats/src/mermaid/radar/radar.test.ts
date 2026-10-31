import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidRadar } from './read';
import { writeMermaidRadar } from './write';

const FIXTURES = ['grades.mmd', 'restaurants.mmd'];
const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'radar', name), 'utf8');
const plotOf = (text: string) => readMermaidRadar(text).document.pages[0] as PlotPage;

describe('reading a Mermaid radar', () => {
  it('reads its axes, curves and options onto one plot page, titled by the front matter', () => {
    const { document, warnings } = readMermaidRadar(fixture('grades.mmd'));
    expect(document.pages[0]).toMatchObject({ kind: 'plot', id: 'page-1', name: 'Grades', width: 640, height: 560 });
    expect((document.pages[0] as PlotPage).data).toEqual({
      kind: 'radar',
      title: 'Grades',
      axes: [
        { id: 'm', label: 'Math' }, { id: 's', label: 'Science' }, { id: 'e', label: 'English' },
        { id: 'h', label: 'History' }, { id: 'g', label: 'Geography' }, { id: 'a', label: 'Art' },
      ],
      curves: [
        { id: 'alice', label: 'Alice', values: [85, 90, 80, 70, 75, 90] },
        { id: 'bob', label: 'Bob', values: [70, 75, 85, 80, 90, 85] },
      ],
      max: 100,
      min: 0,
    });
    expect(warnings).toEqual([]);
  });

  it('reads values named by axis in axis order, over several lines, and the other options', () => {
    expect(plotOf(fixture('restaurants.mmd')).data).toEqual({
      kind: 'radar',
      title: 'Restaurant comparison',
      axes: [{ id: 'food', label: 'Food' }, { id: 'service', label: 'Service' }, { id: 'price' }, { id: 'ambience', label: 'Ambience' }],
      curves: [
        { id: 'a', label: 'Curry house', values: [4, 3.5, 3, 2] },
        { id: 'b', values: [3, 4, 2, 4] },
      ],
      graticule: 'polygon',
      ticks: 4,
      showLegend: false,
      max: 5,
    });
  });

  it('reads several curves on one line', () => {
    expect(plotOf('radar\n  axis x, y\n  curve p{1, 2}, q["Q"]{3, 4}').data).toMatchObject({
      curves: [{ id: 'p', values: [1, 2] }, { id: 'q', label: 'Q', values: [3, 4] }],
    });
  });

  it('warns on what it drops', () => {
    const { warnings } = readMermaidRadar('---\ntitle: Top\n---\n%%{init: {}}%%\nradar-beta\n  accDescr: d\n  title Body\n  axis x');
    expect(warnings).toEqual([
      'The front matter title was dropped; the title statement names the chart.',
      'Mermaid configuration directives were dropped.',
      'Mermaid accessible descriptions were dropped.',
    ]);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidRadar('radar-beta\n  axis a, b\n  curve c{1, 2, 3}')).toThrow('Mermaid, line 3: curve "c" has 3 value(s) for 2 axes');
    expect(() => readMermaidRadar('radar-beta\n  axis a, b\n\n  curve c{a: 1}')).toThrow('Mermaid, line 4: curve "c" has no value for axis "b"');
    expect(() => readMermaidRadar('radar-beta\n  axis a\n  curve c{z: 1}')).toThrow('Mermaid, line 3: curve "c" names no axis "z"');
    expect(() => readMermaidRadar('radar-beta\n  axis a\n  curve c{x}')).toThrow('Mermaid, line 3: "x" is not a number');
    expect(() => readMermaidRadar('radar-beta\n  axis a, 9')).toThrow('Mermaid, line 2: "9" is not an axis');
    expect(() => readMermaidRadar('radar-beta\n  graticule square')).toThrow(/line 2: "square" is not a graticule/);
    expect(() => readMermaidRadar('radar-beta\n  spokes 3')).toThrow('Mermaid, line 2: "spokes" is not a radar statement');
    expect(() => readMermaidRadar('radar-beta\n  axis a\n  curve c{1')).toThrow(/line 3: a curve with no closing/);
    expect(() => readMermaidRadar('radar-alpha')).toThrow(/line 1: "radar-alpha" is not a radar header/);
  });
});

describe('writing a Mermaid radar', () => {
  it('round-trips each fixture', () => {
    for (const name of FIXTURES) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidRadar(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes plainly', () => {
    expect(writeMermaidRadar(plotOf(fixture('restaurants.mmd'))).text).toBe([
      'radar-beta',
      '  title Restaurant comparison',
      '  axis food["Food"], service["Service"], price, ambience["Ambience"]',
      '  curve a["Curry house"]{4, 3.5, 3, 2}',
      '  curve b{3, 4, 2, 4}',
      '  max 5',
      '  graticule polygon',
      '  ticks 4',
      '  showLegend false',
      '',
    ].join('\n'));
  });

  it('warns on what Mermaid cannot hold', () => {
    const page: PlotPage = {
      kind: 'plot', id: 'p', width: 10, height: 10,
      data: { kind: 'radar', axes: [{ id: 'my axis', label: 'Say "hi"' }], curves: [{ id: 'c', values: [] }, { id: 'd', values: [1, 2] }] },
    };
    const { text, warnings } = writeMermaidRadar(page);
    expect(text).toBe('radar-beta\n  axis my_axis["Say \'hi\'"]\n  curve c{0}\n  curve d{1}\n');
    expect(warnings).toEqual([
      'Mermaid ids are a letter or underscore, then letters, digits, "-" or "_"; others were rewritten.',
      'Mermaid labels hold no double quotes; they were written as single quotes.',
      'Mermaid holds a value on every axis; missing ones were written as 0.',
      'Values past the last axis were dropped.',
    ]);
    expect(() => writeMermaidRadar({ ...page, data: { kind: 'pie', slices: [] } as never })).toThrow(/as a radar only/);
  });
});

describe('the Mermaid format', () => {
  it('reads a radar by its header and writes a plot page as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('restaurants.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('radar');
    expect(DIAGRAM_MERMAID.detect(fixture('grades.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('radar-beta\n')).toBe(true);
  });
});

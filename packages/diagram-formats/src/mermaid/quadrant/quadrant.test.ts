import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidQuadrant } from './read';
import { writeMermaidQuadrant } from './write';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'quadrant', name), 'utf8');
const plotOf = (text: string) => readMermaidQuadrant(text).document.pages[0] as PlotPage;

describe('reading a Mermaid quadrant chart', () => {
  it('reads its title, axes, quadrant labels and points onto one plot page', () => {
    const { document, warnings } = readMermaidQuadrant(fixture('campaigns.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'Reach and engagement of campaigns', width: 600, height: 600 });
    expect(page.data).toMatchObject({
      kind: 'quadrant',
      title: 'Reach and engagement of campaigns',
      x: { low: 'Low Reach', high: 'High Reach' },
      y: { low: 'Low Engagement', high: 'High Engagement' },
      quadrants: ['We should expand', 'Need to promote', 'Re-evaluate', 'May be improved'],
    });
    if (page.data.kind !== 'quadrant') throw new Error('not a quadrant chart');
    expect(page.data.points).toHaveLength(6);
    expect(page.data.points[4]).toEqual({ name: 'Campaign E', x: 0.4, y: 0.34 });
    expect(warnings).toEqual([]);
  });

  it('reads styles, classes, quoted text and a low axis end alone', () => {
    expect(plotOf(fixture('styled.mmd')).data).toEqual({
      kind: 'quadrant',
      title: 'Styled points',
      x: { low: 'Low', high: 'High' },
      y: { low: 'Rare' },
      quadrants: ['Ship: now', undefined, 'Later'],
      points: [
        { name: 'Point A', x: 0.9, y: 0, style: { radius: 12 } },
        { name: 'Point B', x: 0.8, y: 0.1, style: { color: '#ff3300', radius: 10 } },
        { name: 'Point C', x: 0.7, y: 0.2, style: { radius: 25, color: '#00ff33', strokeColor: '#10f0f0' } },
        { name: 'Point D', x: 0.6, y: 0.3, style: { radius: 15, strokeColor: '#00ff0f', strokeWidth: 5, color: '#ff33f0' } },
        { name: 'Point E', x: 0.5, y: 0.4, className: 'class1' },
        { name: 'Point: F', x: 0.4, y: 0.5, className: 'class2', style: { color: '#123456' } },
      ],
      classes: {
        class1: { color: '#109060' },
        class2: { color: '#908342', radius: 10, strokeColor: '#310085', strokeWidth: 10 },
      },
    });
  });

  it('warns on what it drops', () => {
    const { warnings } = readMermaidQuadrant('%%{init: {}}%%\nquadrantChart\n  accDescr: about\n  A: [0, 1]');
    expect(warnings).toEqual(['Mermaid configuration directives were dropped.', 'Mermaid accessible descriptions were dropped.']);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidQuadrant('quadrantChart\n  A: [1.2, 0.3]')).toThrow('Mermaid, line 2: a point\'s x and y run from 0 to 1, and [1.2, 0.3] does not');
    expect(() => readMermaidQuadrant('quadrantChart\n\n  A: [x, 0.3]')).toThrow('Mermaid, line 3: "x" is not a number');
    expect(() => readMermaidQuadrant('quadrantChart\n  A: [0.1]')).toThrow(/line 2: a point takes \[x, y\]/);
    expect(() => readMermaidQuadrant('quadrantChart\n  A: [0.1, 0.2] size: 3')).toThrow('Mermaid, line 2: "size" is not a point style');
    expect(() => readMermaidQuadrant('quadrantChart\n  bogus line')).toThrow('Mermaid, line 2: "bogus line" is not a quadrantChart statement');
    expect(() => readMermaidQuadrant('quadrantChart LR')).toThrow('Mermaid, line 1: "quadrantChart LR" is not a quadrantChart header');
  });
});

describe('writing a Mermaid quadrant chart', () => {
  it('round-trips each fixture', () => {
    for (const name of ['campaigns.mmd', 'styled.mmd']) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidQuadrant(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes plainly, quoting what needs it, classes last', () => {
    expect(writeMermaidQuadrant(plotOf(fixture('styled.mmd'))).text).toBe([
      'quadrantChart',
      '  title Styled points',
      '  x-axis Low --> High',
      '  y-axis Rare',
      '  quadrant-1 "Ship: now"',
      '  quadrant-3 Later',
      '  Point A: [0.9, 0] radius: 12',
      '  Point B: [0.8, 0.1] radius: 10, color: #ff3300',
      '  Point C: [0.7, 0.2] radius: 25, color: #00ff33, stroke-color: #10f0f0',
      '  Point D: [0.6, 0.3] radius: 15, color: #ff33f0, stroke-color: #00ff0f, stroke-width: 5px',
      '  Point E:::class1: [0.5, 0.4]',
      '  "Point: F":::class2: [0.4, 0.5] color: #123456',
      '  classDef class1 color: #109060',
      '  classDef class2 radius: 10, color: #908342, stroke-color: #310085, stroke-width: 10px',
      '',
    ].join('\n'));
  });

  it('warns on what Mermaid cannot hold, and throws on another kind of chart', () => {
    const page: PlotPage = {
      kind: 'plot', id: 'p', width: 1, height: 1,
      data: { kind: 'quadrant', x: { high: 'H' }, points: [{ name: 'A', x: 1.5, y: -1 }] },
    };
    const { text, warnings } = writeMermaidQuadrant(page);
    expect(text).toBe('quadrantChart\n  A: [1, 0]\n');
    expect(warnings).toEqual([
      'Mermaid holds an axis\'s high end only with its low end; it was dropped.',
      'Mermaid holds points from 0 to 1 only; others were moved to the nearest edge.',
    ]);
    expect(() => writeMermaidQuadrant({ ...page, data: { kind: 'pie', slices: [] } })).toThrow(/as a quadrant chart only; the page holds a pie/);
  });
});

describe('the Mermaid format', () => {
  it('reads a quadrant chart by its header and writes it back as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('campaigns.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('quadrant');
    expect(DIAGRAM_MERMAID.detect(fixture('styled.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('quadrantChart\n')).toBe(true);
  });
});

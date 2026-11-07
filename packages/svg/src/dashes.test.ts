import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import type { SvgNode, SvgPathNode, SvgStroke } from './types';

const INK = { kind: 'solid' as const, color: '#000' };
const line = (stroke: Partial<SvgStroke>, d = 'M0 0 L100 0'): SvgPathNode => ({
  kind: 'path', path: pathFromD(d), fill: { kind: 'none' }, stroke: { paint: INK, width: 1, ...stroke },
});
const pathTags = (svg: string) => svg.match(/<path [^>]*>/g) ?? [];

describe('a dash in SVG export, decided as the canvas and pdf decide it', () => {
  it('writes a dash the path can hold', () => {
    expect(serializeSvg([line({ dash: [4, 2] })])).toContain('stroke-dasharray="4 2"');
  });

  it('strokes solid a dash too fine for its path', () => {
    const svg = serializeSvg([line({ dash: [1e-4, 1e-4] })]);
    expect(svg).not.toContain('stroke-dasharray');
    expect(svg).toContain('stroke="#000"');
  });

  it('strokes solid an all-zero or negative dash', () => {
    expect(serializeSvg([line({ dash: [0, 0] })])).not.toContain('stroke-dasharray');
    expect(serializeSvg([line({ dash: [5, -1] })])).not.toContain('stroke-dasharray');
  });

  it('draws no stroke for a dash with a non-finite entry, and keeps the fill', () => {
    const svg = serializeSvg([{ ...line({ dash: [4, NaN] }, 'M0 0H10V10Z'), fill: INK }]);
    const [tag] = pathTags(svg);
    expect(tag).toContain('stroke="none"');
    expect(tag).toContain('fill="#000"');
  });

  it('still draws the heads of a stroke whose dash draws no line', () => {
    const svg = serializeSvg([line({ dash: [4, NaN], markerEnd: 'arrow' })]);
    const tags = pathTags(svg.slice(svg.indexOf('</defs>')));
    expect(tags[0]).toContain('stroke-width="0"');
    const outline = tags.find((t) => t.includes('role="stroke-outline"'))!;
    expect(outline).toMatch(/d="M[^"]+"/);
  });

  it('decides on the untrimmed length, as the renderer does', () => {
    // Too fine for the 100-unit line, though the 1-unit window it draws could hold it.
    const svg = serializeSvg([line({ dash: [0.0005, 0.0005], trim: { start: 0, end: 0.01 } })]);
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('draws no text stroke for a non-finite dash, and strokes a negative one solid', () => {
    const text = (dash: number[]): SvgNode => ({
      kind: 'text', x: 0, y: 0, width: 10, height: 10, text: 'a', stroke: { paint: { color: '#f00' }, width: 1, dash },
    });
    expect(serializeSvg([text([4, NaN])])).not.toContain('stroke=');
    const negative = serializeSvg([text([5, -1])]);
    expect(negative).toContain('stroke="#f00"');
    expect(negative).not.toContain('stroke-dasharray');
  });

  it('states a solid stroke on a leaf whose group dashes it', () => {
    const own = line({ dash: [1e-4, 1e-4] });
    const nodes: SvgNode[] = [{
      kind: 'group', stroke: own.stroke, children: [{ ...own, inherits: { stroke: true } }],
    }];
    const leaf = pathTags(serializeSvg(nodes))[0]!;
    expect(leaf).toContain('stroke-dasharray="none"');
  });
});

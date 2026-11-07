import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import { parseSvg } from './parse';
import { svgNodesToKitDrafts } from './unpack';
import { svgStrokeFromKit } from './fromKit';
import type { SvgGroupNode, SvgNode, SvgPathNode, SvgStroke } from './types';

const INK = { kind: 'solid' as const, color: '#000' };
const line = (stroke: Partial<SvgStroke>, d = 'M0 0 L100 0'): SvgPathNode => ({
  kind: 'path', path: pathFromD(d), fill: { kind: 'none' }, stroke: { paint: INK, width: 1, ...stroke },
});
const pathTags = (svg: string) => svg.match(/<path [^>]*>/g) ?? [];

describe('stroke-dashoffset', () => {
  const doc = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  it('is read onto the stroke, inherited from a group, and through a scale', () => {
    const { nodes, warnings } = parseSvg(doc(
      '<path d="M0 0H50" stroke="#000" stroke-dasharray="4 2" stroke-dashoffset="-3"/>'
      + '<g stroke-dashoffset="1.5" transform="scale(2)"><path d="M0 0H50" stroke="#000" stroke-dasharray="4 2"/></g>',
    ));
    expect(warnings).toEqual([]);
    expect((nodes[0] as SvgPathNode).stroke?.dashOffset).toBe(-3);
    const scaled = ((nodes[1] as SvgGroupNode).children[0] as SvgPathNode).stroke!;
    expect(scaled).toMatchObject({ dash: [8, 4], dashOffset: 3 });
  });

  it('round-trips through export, and onto the kit stroke', () => {
    const svg = serializeSvg([line({ dash: [4, 2], dashOffset: 1.25 })]);
    expect(svg).toContain('stroke-dashoffset="1.25"');
    const { nodes } = parseSvg(svg);
    expect((nodes[0] as SvgPathNode).stroke?.dashOffset).toBe(1.25);
    const [draft] = svgNodesToKitDrafts(nodes, () => 'a');
    expect((draft!.data as { stroke?: { dashOffset?: number } }).stroke?.dashOffset).toBe(1.25);
  });

  it('comes out of a kit stroke', () => {
    const stroke = svgStrokeFromKit({ paint: { color: '#000' }, width: 1, dash: [4, 2], dashOffset: 2 }, { x: 0, y: 0, width: 1, height: 1 });
    expect(stroke?.dashOffset).toBe(2);
  });

  it('adds to the phase a trimmed run starts at', () => {
    const svg = serializeSvg([line({ dash: [4, 2], dashOffset: 1, trim: { start: 0.1 } })]);
    expect(svg).toContain('stroke-dashoffset="11"');
  });

  it('is written on a text stroke', () => {
    const svg = serializeSvg([{
      kind: 'text', x: 0, y: 0, width: 10, height: 10, text: 'a',
      stroke: { paint: { color: '#000' }, width: 1, dash: [2, 1], dashOffset: 0.5 },
    }]);
    expect(svg).toContain('stroke-dashoffset="0.5"');
  });
});

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

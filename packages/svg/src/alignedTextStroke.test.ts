import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import { parseSvg } from './parse';
import type { SvgNode, SvgTextNode } from './types';

const RED = { paint: { kind: 'solid' as const, color: '#ff0000' } };
const text = (stroke: Stroke, extra: Partial<SvgTextNode> = {}): SvgTextNode => ({
  kind: 'text', x: 10, y: 20, width: 40, height: 14, text: 'Hi', fill: RED, stroke, ...extra,
});
const write = (nodes: SvgNode[]) => {
  const warnings: string[] = [];
  return { svg: serializeSvg(nodes, { onWarn: (m) => warnings.push(m) }), warnings };
};
const tags = (svg: string, name: string) => svg.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];

describe('an inner or outer text stroke in SVG', () => {
  it('draws an inner stroke as a doubled copy clipped to the glyphs, with no warning', () => {
    const { svg, warnings } = write([text({ paint: { color: '#0000ff' }, width: 2, align: 'inner' })]);
    expect(warnings).toEqual([]);
    const [base, clipGlyphs, copy] = tags(svg, 'text');
    expect(base).toContain('stroke-width="0"');
    expect(base).toContain('wzl:stroke-align="inner"');
    expect(base).toContain('fill="#ff0000"');
    expect(svg).toMatch(/<clipPath id="(\w+)" wzl:role="stroke-outline">/);
    expect(clipGlyphs).not.toContain('stroke=');
    expect(copy).toMatch(/clip-path="url\(#\w+\)"/);
    expect(copy).toContain('stroke-width="4"');
    expect(copy).toContain('fill="none"');
  });

  it('draws an outer stroke as a doubled copy masked to outside the glyphs', () => {
    const { svg } = write([text({ paint: { color: '#0000ff' }, width: 2, align: 'outer' })]);
    expect(svg).toMatch(/<mask id="\w+" maskUnits="userSpaceOnUse"[^>]*>/);
    expect(svg).toMatch(/<mask [^>]*><rect [^>]*fill="#ffffff"/);
    const copy = tags(svg, 'text').at(-1)!;
    expect(copy).toMatch(/mask="url\(#\w+\)"/);
    expect(copy).toContain('stroke-width="4"');
  });

  it('puts the frame and opacity on the group, so the clip shares the copy\'s space', () => {
    const { svg } = write([text({ ...RED, width: 1, align: 'inner' }, { rotation: Math.PI / 2, opacity: 0.5 })]);
    expect(svg).toMatch(/<g transform="rotate\(90 [^"]+\)" opacity="0.5" wzl:role="stroke-group">/);
    for (const t of tags(svg, 'text')) expect(t).not.toContain('transform=');
  });

  it('strokes only the runs of each alignment in each copy', () => {
    const { svg } = write([text({ paint: { color: '#000' }, width: 1 }, {
      text: 'ab',
      runs: [{ text: 'a', stroke: { paint: { color: '#00ff00' }, width: 3, align: 'outer' } }, { text: 'b' }],
    })]);
    const copy = svg.slice(svg.lastIndexOf('<text '));
    expect(copy).toContain('stroke-width="6"');
    expect(copy.match(/<tspan[^>]*>/g)![1]).toContain('stroke="none"');
  });

  it('reads back as one text node with its aligned strokes', () => {
    const node = text({ paint: { color: '#0000ff' }, width: 2, align: 'outer' }, {
      rotation: 0.3, opacity: 0.5, text: 'ab',
      runs: [{ text: 'a', stroke: { paint: { color: '#00ff00' }, width: 3, align: 'inner' } }, { text: 'b' }],
    });
    const { nodes, warnings } = parseSvg(write([node]).svg);
    expect(warnings).toEqual([]);
    expect(nodes).toHaveLength(1);
    const back = nodes[0] as SvgTextNode;
    expect(back.kind).toBe('text');
    expect(back.stroke).toMatchObject({ width: 2, align: 'outer' });
    expect(back.runs?.[0]?.stroke).toMatchObject({ width: 3, align: 'inner' });
    expect(back.opacity).toBe(0.5);
    expect(back.rotation).toBeCloseTo(0.3, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const text = (body: string): { node: SvgTextNode; warnings: string[] } => {
  const { nodes, warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  return { node: nodes[0] as SvgTextNode, warnings };
};

describe('lines of text written as positioned tspans', () => {
  it('breaks at a tspan that returns to x and steps down by dy', () => {
    const { node, warnings } = text(
      '<text x="10" y="20"><tspan x="10" dy="0">Line one</tspan><tspan x="10" dy="1.2em">Line two</tspan></text>',
    );
    expect(warnings).toEqual([]);
    expect(node.text).toBe('Line one\nLine two');
    // Two lines of the default 16px at the default 1.2 line height.
    expect(node.height).toBeCloseTo(38.4, 6);
  });

  it('breaks at a tspan with its own x and y', () => {
    expect(text('<text><tspan x="10" y="20">A</tspan><tspan x="10" y="40">B</tspan></text>').node.text).toBe('A\nB');
  });

  it('keeps the source file\'s indentation out of the lines', () => {
    const { node } = text(`<text x="10" y="20">
      <tspan x="10" dy="0">Line one</tspan>
      <tspan x="10" dy="19">Line  two</tspan>
    </text>`);
    expect(node.text).toBe('Line one\nLine two');
  });

  it('keeps one line for a tspan that only restyles or only moves sideways', () => {
    expect(text('<text>a<tspan font-weight="bold">b</tspan>c</text>').node.text).toBe('abc');
    expect(text('<text><tspan x="0">a</tspan><tspan x="30">b</tspan></text>').node.text).toBe('ab');
    expect(text('<text><tspan x="0" y="5">a</tspan><tspan x="30" y="5">b</tspan></text>').node.text).toBe('ab');
  });

  it('keeps the runs in step with the text', () => {
    const { node } = text(
      '<text><tspan x="0" dy="0" font-weight="bold">A</tspan><tspan x="0" dy="20">B</tspan></text>',
    );
    expect(node.runs?.map((r) => r.text)).toEqual(['A', '\nB']);
    expect(node.runs?.map((r) => r.text).join('')).toBe(node.text);
  });

  it('survives export and import', () => {
    const { node } = text('<text x="10" y="20"><tspan x="10" dy="0">One</tspan><tspan x="10" dy="20">Two</tspan></text>');
    expect((parseSvg(serializeSvg([node])).nodes[0] as SvgTextNode).text).toBe('One\nTwo');
  });

  it('reads the pitch the lines state as the line height', () => {
    const byDy = text('<text x="10" y="20" font-size="10"><tspan x="10" dy="0">A</tspan><tspan x="10" dy="2em">B</tspan><tspan x="10" dy="20">C</tspan></text>');
    expect(byDy.warnings).toEqual([]);
    expect(byDy.node.style?.lineHeight).toBeCloseTo(2);
    expect(byDy.node.height).toBeCloseTo(60);
    const byY = text('<text font-size="10"><tspan x="10" y="20">A</tspan><tspan x="10" y="35">B</tspan></text>');
    expect(byY.node.style?.lineHeight).toBeCloseTo(1.5);
    expect(byY.node.height).toBeCloseTo(30);
  });

  it('reads the pitch of a line that follows bare text', () => {
    const { node } = text('<text x="0" y="20" font-size="10">A<tspan x="0" dy="30">B</tspan></text>');
    expect(node.style?.lineHeight).toBeCloseTo(3);
  });

  it('leaves the default line height unstated', () => {
    const { node } = text('<text x="10" y="20"><tspan x="10" dy="0">A</tspan><tspan x="10" dy="1.2em">B</tspan></text>');
    expect(node.style?.lineHeight).toBeUndefined();
  });

  it('takes the mean of uneven pitches, and says so', () => {
    const { node, warnings } = text('<text font-size="10"><tspan x="0" y="10">A</tspan><tspan x="0" y="20">B</tspan><tspan x="0" y="40">C</tspan></text>');
    expect(node.style?.lineHeight).toBeCloseTo(1.5);
    expect(warnings).toEqual([expect.stringMatching(/uneven/)]);
  });

  it('leaves a tspan that moves up out of the pitch', () => {
    const { node } = text('<text font-size="10"><tspan x="0" y="10">A</tspan><tspan x="0" y="25">B</tspan><tspan x="0" y="-5">C</tspan></text>');
    expect(node.style?.lineHeight).toBeCloseTo(1.5);
  });

  it('reports per-glyph positions it reads only the first of', () => {
    const { node, warnings } = text('<text x="10 20 30" y="5">abc</text>');
    expect(node.text).toBe('abc');
    expect(warnings).toEqual([expect.stringMatching(/x="10 20 30"/)]);
  });

  it('reports them on a tspan too', () => {
    const { node, warnings } = text('<text x="10" y="5"><tspan x="10 20 30">abc</tspan></text>');
    expect(node.text).toBe('abc');
    expect(warnings).toEqual([expect.stringMatching(/<tspan x="10 20 30">/)]);
  });

  it('reports a dy list, and a tspan moved off the line without starting a new one', () => {
    const list = text('<text x="10" y="5"><tspan dy="0 3 0">abc</tspan></text>');
    expect(list.warnings).toEqual([expect.stringMatching(/<tspan dy="0 3 0"> positions each glyph/)]);
    const raised = text('<text x="10" y="20">a<tspan dy="-5">b</tspan></text>');
    expect(raised.node.text).toBe('ab');
    expect(raised.warnings).toEqual([expect.stringMatching(/<tspan dy="-5"> is not read/)]);
    const placed = text('<text x="10" y="20">a<tspan y="12">b</tspan></text>');
    expect(placed.warnings).toEqual([expect.stringMatching(/<tspan y="12"> is not read/)]);
  });

  it('reports the rotate it does not read', () => {
    const { warnings } = text('<text x="10" y="5" rotate="45"><tspan rotate="10">a</tspan><tspan rotate="0">b</tspan></text>');
    expect(warnings).toEqual([
      expect.stringMatching(/<text rotate="45">/),
      expect.stringMatching(/<tspan rotate="10">/),
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const text = (body: string): { node: SvgTextNode; warnings: string[] } => {
  const { nodes, warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  return { node: nodes[0] as SvgTextNode, warnings };
};
const spacing = (node: SvgTextNode) => node.runs?.map((r) => [r.text, r.letterSpacing]);

describe('a tspan dx list read as letter spacing', () => {
  it('gives each glyph the shift of the glyph after it as extra advance', () => {
    const even = text('<text x="10" y="5"><tspan dx="0 2 2">abc</tspan></text>');
    expect(even.warnings).toEqual([]);
    expect(even.node.text).toBe('abc');
    expect(spacing(even.node)).toEqual([['ab', 2], ['c', undefined]]);

    const kerned = text('<text x="10" y="5"><tspan dx="0 1 -0.5 0 3">abcde</tspan></text>');
    expect(spacing(kerned.node)).toEqual([['a', 1], ['b', -0.5], ['c', undefined], ['d', 3], ['e', undefined]]);
  });

  it('stops at the end of a list shorter than the text', () => {
    expect(spacing(text('<text><tspan dx="0 2">abcd</tspan></text>').node)).toEqual([['a', 2], ['bcd', undefined]]);
  });

  it('lands a leading shift on the glyph before the tspan', () => {
    const { node, warnings } = text('<text x="10" y="5">ab<tspan dx="4">cd</tspan></text>');
    expect(warnings).toEqual([]);
    expect(spacing(node)).toEqual([['a', undefined], ['b', 4], ['cd', undefined]]);
    expect(node.text).toBe('abcd');
  });

  it('moves the text by a leading shift that opens it', () => {
    const { node, warnings } = text('<text x="10" y="5"><tspan dx="3 1">ab</tspan></text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(13);
    expect(spacing(node)).toEqual([['a', 1], ['b', undefined]]);
  });

  it('adds to the letter spacing already in force', () => {
    const { node } = text('<text letter-spacing="1"><tspan dx="0 2">ab</tspan><tspan letter-spacing="5" dx="0 2">cd</tspan></text>');
    expect(spacing(node)).toEqual([['a', 3], ['b', undefined], ['c', 7], ['d', 5]]);
  });

  it('reads a shift in ems of the tspan font size', () => {
    expect(spacing(text('<text font-size="10"><tspan dx="0 0.5em">ab</tspan></text>').node)).toEqual([['a', 5], ['b', undefined]]);
  });

  it('survives export and import', () => {
    const { node } = text('<text x="10" y="5"><tspan dx="0 2 2">abc</tspan></text>');
    const back = parseSvg(serializeSvg([node])).nodes[0] as SvgTextNode;
    expect(spacing(back)).toEqual([['ab', 2], ['c', undefined]]);
  });

  it('says so where a leading shift opens a later line, which the model starts at the box edge', () => {
    const { node, warnings } = text('<text><tspan x="0" dy="0">A</tspan><tspan x="0" dy="20" dx="3 1">BC</tspan></text>');
    expect(node.text).toBe('A\nBC');
    expect(warnings).toEqual([expect.stringMatching(/dx="3 1"/)]);
    expect(spacing(node)).toEqual([['A', undefined], ['\nB', 1], ['C', undefined]]);
  });

  it('leaves a list unread, and says so, where collapsing white space would move its glyphs', () => {
    const { node, warnings } = text('<text><tspan dx="0 2 2"> a  b</tspan></text>');
    expect(node.text).toBe('a b');
    expect(warnings).toEqual([expect.stringMatching(/dx="0 2 2"/)]);
  });
  it('reads a dx list on a text holding only text, the same way', () => {
    const { node, warnings } = text('<text x="10" y="5" dx="3 1 2">abc</text>');
    expect(warnings).toEqual([]);
    expect(node.x).toBeCloseTo(13);
    expect(node.text).toBe('abc');
    expect(spacing(node)).toEqual([['a', 1], ['b', 2], ['c', undefined]]);
  });
});

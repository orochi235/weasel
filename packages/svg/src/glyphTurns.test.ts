import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const text = (body: string): { node: SvgTextNode; warnings: string[] } => {
  const { nodes, warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  return { node: nodes[0] as SvgTextNode, warnings };
};
const turns = (node: SvgTextNode) => node.runs?.map((r) => [r.text, r.rotate]);

describe('turned glyphs, read as rotate', () => {
  it('turns every glyph by a single value', () => {
    const { node, warnings } = text('<text x="10" y="20" rotate="30">abc</text>');
    expect(warnings).toEqual([]);
    expect(node.text).toBe('abc');
    expect(turns(node)).toEqual([['abc', 30]]);
  });

  it('turns glyph by glyph, the last value carrying on past the list\'s end', () => {
    const { node, warnings } = text('<text x="10" y="20" rotate="0 10 20">abcde</text>');
    expect(warnings).toEqual([]);
    expect(turns(node)).toEqual([['a', undefined], ['b', 10], ['cde', 20]]);
  });

  it('hands a text\'s list through its tspans, a tspan\'s own list winning', () => {
    const { node, warnings } = text('<text x="0" y="20" rotate="5 6 7">a<tspan>b</tspan><tspan rotate="90">cd</tspan>e</text>');
    expect(warnings).toEqual([]);
    expect(node.text).toBe('abcde');
    // e is past the end of the text's list, so it takes the list's last value.
    expect(turns(node)).toEqual([['a', 5], ['b', 6], ['cd', 90], ['e', 7]]);
  });

  it('keeps a tspan\'s own last value for its glyphs past its own list', () => {
    const { node } = text('<text x="0" y="20" rotate="1"><tspan rotate="45 -45">abc</tspan>d</text>');
    expect(turns(node)).toEqual([['a', 45], ['bc', -45], ['d', 1]]);
  });

  it('turns glyphs that a dx list also spaces', () => {
    const { node, warnings } = text('<text x="0" y="20"><tspan dx="0 4" rotate="0 15">ab</tspan></text>');
    expect(warnings).toEqual([]);
    expect(node.runs?.map((r) => [r.text, r.letterSpacing, r.rotate])).toEqual([['a', 4, undefined], ['b', undefined, 15]]);
  });

  it('reports a list that collapsing white space would move, and reads none of it', () => {
    const { node, warnings } = text('<text x="0" y="20" rotate="10 20">a  b</text>');
    expect(warnings).toEqual([expect.stringMatching(/<text rotate="10 20"> is not read: its text has white space/)]);
    expect(node.runs?.some((r) => r.rotate !== undefined) ?? false).toBe(false);
  });

  it('reads a list over white space xml:space="preserve" keeps', () => {
    const { node, warnings } = text('<text x="0" y="20" rotate="10 20 30 40" xml:space="preserve">a  b</text>');
    expect(warnings).toEqual([]);
    expect(turns(node)).toEqual([['a', 10], [' ', 20], [' ', 30], ['b', 40]]);
  });

  it('reads one value over white space SVG collapses', () => {
    const { node, warnings } = text('<text x="0" y="20" rotate="10">a  b</text>');
    expect(warnings).toEqual([]);
    expect(node.runs?.every((r) => r.rotate === 10)).toBe(true);
  });

  it('writes a run\'s turn on its tspan and reads it back', () => {
    const node: SvgTextNode = {
      kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'abc',
      runs: [{ text: 'a' }, { text: 'bc', rotate: 30 }],
    };
    const svg = serializeSvg([node]);
    expect(svg).toMatch(/<tspan rotate="30">bc<\/tspan>/);
    const back = parseSvg(svg).nodes[0] as SvgTextNode;
    expect(turns(back)).toEqual([['a', undefined], ['bc', 30]]);
  });
});

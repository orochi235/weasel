import { describe, expect, it } from 'vitest';
import type { StyledRun } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const node = (text: string, extra: Partial<SvgTextNode> = {}): SvgTextNode => ({
  kind: 'text', x: 10, y: 20, width: 100, height: 40, text, style: { fontSize: 10 }, ...extra,
});
const body = (n: SvgTextNode): string => /<text[^>]*>(.*)<\/text>/s.exec(serializeSvg([n]))![1];
const back = (n: SvgTextNode): { node: SvgTextNode; warnings: string[] } => {
  const { nodes, warnings } = parseSvg(serializeSvg([n]));
  return { node: nodes[0] as SvgTextNode, warnings };
};

describe('hard line breaks on export', () => {
  it('writes each line after the first as a tspan back at x and one pitch down', () => {
    expect(body(node('one\ntwo\nthree'))).toBe(
      'one<tspan x="10" dy="12">two</tspan><tspan x="10" dy="12">three</tspan>',
    );
  });

  it('pitches the lines at the node\'s line height, and reads it back', () => {
    const n = node('one\ntwo', { style: { fontSize: 10, lineHeight: 1.5 } });
    expect(body(n)).toBe('one<tspan x="10" dy="15">two</tspan>');
    expect(back(n).node.style?.lineHeight).toBe(1.5);
  });

  it('states the line height of a single line, which has no pitch to show it', () => {
    const n = node('one', { style: { fontSize: 10, lineHeight: 1.5 } });
    expect(serializeSvg([n])).toContain('data-weasel-line-height="1.5"');
    expect(back(n).node.style?.lineHeight).toBe(1.5);
    expect(back(node('one', { style: { fontSize: 10, lineHeight: 1.2 } })).node.style?.lineHeight).toBe(1.2);
  });

  it('reads the pitch over a stated line height the lines no longer keep', () => {
    const { nodes } = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><text font-size="10" data-weasel-line-height="1.5">'
      + 'one<tspan x="0" dy="20">two</tspan></text></svg>');
    expect((nodes[0] as SvgTextNode).style?.lineHeight).toBe(2);
  });

  it('sends each line back to the anchor point', () => {
    expect(body(node('one\ntwo', { style: { fontSize: 10, align: 'center' } })))
      .toBe('one<tspan x="60" dy="12">two</tspan>');
  });

  it('folds a blank line into the next line\'s dy', () => {
    const n = node('a\n\n\nb');
    expect(body(n)).toBe('a<tspan x="10" dy="36" data-weasel-lines="3">b</tspan>');
    const read = back(n);
    expect(read.warnings).toEqual([]);
    expect(read.node.text).toBe('a\n\n\nb');
    expect(read.node.style?.lineHeight).toBeUndefined();
  });

  it.each(['\na', '\n\na', 'a\n', 'a\n\n', '\n', '\n\n', '\na\n\nb\n'])('reads %j back', (text) => {
    const read = back(node(text));
    expect(read.warnings).toEqual([]);
    expect(read.node.text).toBe(text);
  });

  it('breaks a styled run across lines and reads it back as one run', () => {
    const runs: StyledRun[] = [{ text: 'a\nb', bold: true }, { text: 'c' }];
    const n = node('a\nbc', { runs });
    expect(body(n)).toBe(
      '<tspan font-weight="700">a</tspan><tspan font-weight="700" x="10" dy="12">b</tspan><tspan>c</tspan>',
    );
    expect(back(n).node.runs).toEqual(runs);
  });

  it('keeps a break between two differently styled runs', () => {
    const runs: StyledRun[] = [{ text: 'a', bold: true }, { text: '\nb', italic: true }];
    expect(back(node('a\nb', { runs })).node.runs).toEqual(runs);
  });

  it('reads a foreign double pitch, which states no line count, as uneven', () => {
    const { nodes, warnings } = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text font-size="10"><tspan x="0" y="10">A</tspan>'
      + '<tspan x="0" dy="12">B</tspan><tspan x="0" dy="24">C</tspan></text></svg>',
    );
    expect((nodes[0] as SvgTextNode).text).toBe('A\nB\nC');
    expect(warnings).toEqual([expect.stringMatching(/uneven/)]);
  });
});

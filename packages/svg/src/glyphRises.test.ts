import { describe, expect, it } from 'vitest';
import { SCRIPT_METRICS } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const text = (body: string): { node: SvgTextNode; warnings: string[] } => {
  const { nodes, warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  return { node: nodes[0] as SvgTextNode, warnings };
};
const shifts = (node: SvgTextNode) => node.runs?.map((r) => [r.text, r.baselineShift]);

describe('glyphs moved off their line, read as baseline shift', () => {
  it('reads a tspan dy list as a rise that carries on to the glyphs after', () => {
    const { node, warnings } = text('<text x="10" y="5" font-size="10"><tspan dy="0 3 0">abc</tspan></text>');
    expect(warnings).toEqual([]);
    expect(node.text).toBe('abc');
    expect(shifts(node)).toEqual([['a', undefined], ['bc', -0.3]]);
  });

  it('raises a tspan moved by dy without an x, and the text after it, until it moves back', () => {
    const carried = text('<text x="10" y="20" font-size="10">a<tspan dy="-5">b</tspan>c</text>');
    expect(carried.warnings).toEqual([]);
    expect(carried.node.text).toBe('abc');
    expect(shifts(carried.node)).toEqual([['a', undefined], ['b', 0.5], ['c', 0.5]]);
    const back = text('<text x="10" y="20" font-size="10">a<tspan dy="-5">b</tspan><tspan dy="5">c</tspan></text>');
    expect(shifts(back.node)).toEqual([['a', undefined], ['b', 0.5], ['c', undefined]]);
  });

  it('reads a y without an x, and a y list, against the line', () => {
    const placed = text('<text y="20" font-size="10">a<tspan y="12">b</tspan></text>');
    expect(placed.warnings).toEqual([]);
    expect(shifts(placed.node)).toEqual([['a', undefined], ['b', 0.8]]);
    const list = text('<text y="20" font-size="10"><tspan y="20 15 25">abc</tspan></text>');
    expect(list.warnings).toEqual([]);
    expect(shifts(list.node)).toEqual([['a', undefined], ['b', 0.5], ['c', -0.5]]);
  });

  it('hands a text\'s list to the glyph it counts to, through its tspans, its first dy unread', () => {
    const { node, warnings } = text('<text y="20" dy="3 0 -4" font-size="10">ab<tspan>cd</tspan></text>');
    expect(warnings).toEqual([]);
    expect(shifts(node)).toEqual([['ab', undefined], ['cd', 0.4]]);
    const own = text('<text y="20" dy="0 0 -4" font-size="10">ab<tspan dy="-2">cd</tspan></text>');
    expect(shifts(own.node)).toEqual([['ab', undefined], ['cd', 0.2]]);
  });

  it('ends a rise at a new line, and pitches the line from the last one\'s baseline', () => {
    const { node } = text('<text x="0" y="20" font-size="10">a<tspan dy="-5">b</tspan><tspan x="0" dy="20">c</tspan></text>');
    expect(node.text).toBe('ab\nc');
    expect(node.runs?.map((r) => r.baselineShift)).toEqual([undefined, 0.5, undefined]);
    expect(node.style?.lineHeight).toBeCloseTo(1.5);
  });

  it('keeps a tspan that returns to its line\'s baseline on that line', () => {
    const { node } = text('<text font-size="10"><tspan x="0" y="10">a</tspan><tspan dy="-2">b</tspan><tspan x="30" y="10">c</tspan></text>');
    expect(node.text).toBe('abc');
    expect(shifts(node)).toEqual([['a', undefined], ['b', 0.2], ['c', undefined]]);
  });

  it('adds the rise to a run\'s own baseline shift, or its script\'s', () => {
    const own = text('<text y="20" font-size="10">a<tspan dy="-5" baseline-shift="10%">b</tspan></text>');
    expect(own.node.runs?.[1].baselineShift).toBeCloseTo(0.6);
    const script = text('<text y="20" font-size="10">a<tspan dy="-5" baseline-shift="super">b</tspan></text>');
    expect(script.node.runs?.[1].script).toBe('super');
    expect(script.node.runs?.[1].baselineShift).toBeCloseTo(SCRIPT_METRICS.super.shift + 0.5);
  });

  it('reads a list only to its first value, and says so, where collapsing white space would move its glyphs', () => {
    const { node, warnings } = text('<text y="20" font-size="10"><tspan dy="-1 3">a  b</tspan></text>');
    expect(warnings).toEqual([expect.stringMatching(/<tspan dy="-1 3"> is read only to its first value/)]);
    expect(shifts(node)).toEqual([['a b', 0.1]]);
  });

  it('survives export and import', () => {
    const { node } = text('<text x="10" y="20" font-size="10">a<tspan dy="-5">b</tspan>c</text>');
    const back = parseSvg(serializeSvg([node])).nodes[0] as SvgTextNode;
    expect(shifts(back)).toEqual([['a', undefined], ['b', 0.5], ['c', 0.5]]);
  });
});

import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import type { SvgNode } from './types';

const textIn = (n: SvgNode | undefined): SvgNode | undefined => (n?.kind === 'group' ? textIn(n.children[0]) : n);
const topOf = (body: string): number | undefined => {
  const n = textIn(parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`).nodes[0]);
  return n?.kind === 'text' ? n.y : undefined;
};

describe('dominant-baseline through the cascade', () => {
  it('puts the box top at y wherever the text takes a hanging baseline from', () => {
    expect(topOf('<text y="10" font-size="20" dominant-baseline="hanging">A</text>')).toBeCloseTo(10);
    expect(topOf('<g dominant-baseline="hanging"><text y="10" font-size="20">A</text></g>')).toBeCloseTo(10);
    expect(topOf('<style>text{dominant-baseline:text-before-edge}</style><text y="10" font-size="20">A</text>')).toBeCloseTo(10);
    expect(topOf('<text y="10" font-size="20" style="dominant-baseline:hanging">A</text>')).toBeCloseTo(10);
  });

  it('keeps y the baseline otherwise', () => {
    expect(topOf('<text y="30" font-size="20">A</text>')).toBeCloseTo(10);
  });
});

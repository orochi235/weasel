import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import type { SvgTextNode } from './types';

function runsOf(body: string) {
  const parsed = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  const node = parsed.nodes[0] as SvgTextNode;
  return { runs: node.runs ?? [], text: node.text, warnings: parsed.warnings };
}

const runWith = <R extends { text: string }>(runs: readonly R[], text: string): R | undefined => runs.find((r) => r.text === text);

describe('a <tspan> inside a <tspan>', () => {
  it('takes its own fill and dy over its parent tspan\'s weight', () => {
    const { runs, warnings } = runsOf('<text><tspan font-weight="bold">a<tspan fill="red" dy="5">b</tspan></tspan></text>');
    expect(runs.map((r) => r.text).join('')).toBe('ab');
    const a = runWith(runs, 'a');
    const b = runWith(runs, 'b');
    expect(a).toMatchObject({ bold: true });
    expect(a?.fill).toBeUndefined();
    expect(a?.baselineShift ?? 0).toBe(0);
    expect(b).toMatchObject({ bold: true, fill: { paint: { kind: 'solid', color: '#ff0000' } } });
    expect(b?.baselineShift).toBeLessThan(0);
    expect(warnings).toEqual([]);
  });

  it('gives the text after it back its parent tspan\'s styling', () => {
    const { runs } = runsOf('<text><tspan font-weight="bold">a<tspan fill="red">b</tspan>c</tspan></text>');
    expect(runWith(runs, 'c')).toMatchObject({ bold: true });
    expect(runWith(runs, 'c')?.fill).toBeUndefined();
  });

  it('overrides its parent tspan\'s weight with its own', () => {
    const { runs } = runsOf('<text><tspan font-weight="bold">a<tspan font-weight="normal">b</tspan></tspan></text>');
    expect(runWith(runs, 'b')?.bold).toBeUndefined();
    expect(runWith(runs, 'b')?.fontWeight).toBe(400);
  });

  it('moves its glyphs by its parent\'s lists where it has none of its own', () => {
    const { runs } = runsOf('<text><tspan dy="0 5">a<tspan fill="red">b</tspan></tspan></text>');
    expect(runWith(runs, 'a')?.baselineShift ?? 0).toBe(0);
    expect(runWith(runs, 'b')?.baselineShift).toBeLessThan(0);
  });

  it('turns its glyphs by its parent\'s rotate, whose last value goes on', () => {
    const { runs } = runsOf('<text><tspan rotate="10 20">a<tspan fill="red">bc</tspan></tspan></text>');
    expect(runWith(runs, 'a')?.rotate).toBe(10);
    expect(runWith(runs, 'bc')?.rotate).toBe(20);
  });

  it('reads a tspan nested two deep through both its parents', () => {
    const { runs, warnings } = runsOf(
      '<text><tspan font-style="italic">a<tspan font-weight="bold">b<tspan fill="red">c</tspan></tspan></tspan></text>',
    );
    expect(runWith(runs, 'c')).toMatchObject({ italic: true, bold: true, fill: { paint: { color: '#ff0000' } } });
    expect(warnings).toEqual([]);
  });

  it('still reports another element inside a tspan, read as its text', () => {
    const { text, warnings } = runsOf('<text><tspan>a<span>b</span></tspan></text>');
    expect(text).toBe('ab');
    expect(warnings.some((w) => w.includes('<span>'))).toBe(true);
  });
});

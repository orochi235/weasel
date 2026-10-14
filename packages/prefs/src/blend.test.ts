import { describe, expect, it } from 'vitest';
import { blendPref } from './blend';
import type { PrefLeaf } from './schema';

const leaf = (kind: string, extra: object = {}): PrefLeaf => ({ kind, name: 'x', description: '', default: undefined, ...extra }) as PrefLeaf;
const at = (...pairs: [unknown, number][]) => pairs.map(([value, weight]) => ({ value, weight }));

describe('blendPref', () => {
  it('is the one member, untouched, where only one weighs anything', () => {
    const value = { a: 1 };
    expect(blendPref(leaf('object'), at([value, 1]))).toBe(value);
  });

  it('is the default where no member weighs anything', () => {
    expect(blendPref(leaf('number', { default: 7 }), [])).toBe(7);
  });

  it('weighs numbers, whatever the weights sum to', () => {
    expect(blendPref(leaf('number'), at([4, 0.25], [8, 0.25], [6, 0.5]))).toBe(6);
    expect(blendPref(leaf('number'), at([4, 1], [8, 3]))).toBe(7);
  });

  it('takes the heaviest number where one of them is not finite', () => {
    expect(blendPref(leaf('number'), at([4, 0.4], [Infinity, 0.6]))).toBe(Infinity);
  });

  it('blends colors in OKLCH: a midpoint between black and white is a mid gray, lighter than the sRGB one', () => {
    const mid = blendPref(leaf('color'), at(['#000000', 0.5], ['#ffffff', 0.5])) as string;
    expect(mid).toMatch(/^#([0-9a-f]{2})\1\1$/);
    const level = parseInt(mid.slice(1, 3), 16);
    expect(level).toBeGreaterThan(90);
    expect(level).toBeLessThan(127);
  });

  it('gives a color the weight it has: near an end, the blend is near that end', () => {
    const near = blendPref(leaf('color'), at(['#000000', 0.95], ['#ffffff', 0.05])) as string;
    expect(parseInt(near.slice(1, 3), 16)).toBeLessThan(40);
  });

  it('blends alpha linearly', () => {
    expect(blendPref(leaf('color', { alpha: true }), at(['#ff000000', 0.5], ['#ff0000ff', 0.5]))).toBe('#ff000080');
  });

  it('takes the heaviest color where one of them is not a hex color', () => {
    expect(blendPref(leaf('color'), at(['#000000', 0.4], ['rebeccapurple', 0.6]))).toBe('rebeccapurple');
  });

  it('takes the heaviest member of a kind that cannot blend, the first of them on a tie', () => {
    expect(blendPref(leaf('enum'), at(['tight', 0.25], ['loose', 0.75]))).toBe('loose');
    expect(blendPref(leaf('boolean'), at([true, 0.5], [false, 0.5]))).toBe(true);
  });

  it('uses a blend given for a kind, an app-defined one included', () => {
    const blends = { tag: (members: readonly { value: unknown }[]) => members.map((m) => m.value).join('+') };
    expect(blendPref(leaf('tag'), at(['a', 0.5], ['b', 0.5]), blends)).toBe('a+b');
  });
});

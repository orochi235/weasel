import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { mergeChain } from './merge';

const base: ThemeDefinition = {
  name: 'base',
  axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
  ramps: {
    gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.9, 0.2] },
    accent: { kind: 'lightness', steps: ['x'], lightness: [0.5, 0.5] },
  },
  pins: { 'radius-md': '5px' },
};
const defs: Record<string, ThemeDefinition> = { base };
const lookup = (n: string) => defs[n];

describe('mergeChain', () => {
  it('replaces entries whole and inherits the rest, keeping the parent key order', () => {
    const child: ThemeDefinition = {
      name: 'child',
      extends: 'base',
      ramps: { gray: { kind: 'lightness', steps: ['a'], lightness: [0.8, 0.3] } },
    };
    const m = mergeChain(child, lookup);
    expect(m.name).toBe('child');
    expect(Object.keys(m.ramps!)).toEqual(['gray', 'accent']);
    expect(m.ramps!.gray.steps).toEqual(['a']);
    expect(m.pins).toEqual({ 'radius-md': '5px' });
    expect(m.axes).toEqual(base.axes);
  });

  it('keeps the union of an axis both declare, the child’s values and default winning', () => {
    const child: ThemeDefinition = {
      name: 'child',
      extends: 'base',
      axes: { mode: { default: 'dim', values: { dark: { scheme: 'dark' }, dim: {} } } },
    };
    expect(mergeChain(child, lookup).axes).toEqual({
      mode: { default: 'dim', values: { dark: { scheme: 'dark' }, light: {}, dim: {} } },
    });
  });

  it('throws on an unknown parent and on a cycle', () => {
    expect(() => mergeChain({ name: 'c', extends: 'nope' }, lookup)).toThrow(/nope/);
    const loop: Record<string, ThemeDefinition> = { a: { name: 'a', extends: 'b' }, b: { name: 'b', extends: 'a' } };
    expect(() => mergeChain(loop.a, (n) => loop[n])).toThrow(/cycle/);
  });
});

describe('a theme that declares a ramp or scale', () => {
  const parent: ThemeDefinition = {
    name: 'p',
    ramps: { gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.9, 0.2] } },
    scales: { space: { steps: ['sm'], base: 4, step: 4 } },
    pins: { 'gray-a': '#ffffff', 'gray-b': '#000000', 'space-sm': '3px', radius: '4px' },
  };
  const lookup = (name: string) => (name === 'p' ? parent : undefined);

  it("drops the parent's pins on its steps and keeps its own", () => {
    const child: ThemeDefinition = {
      name: 'c',
      extends: 'p',
      ramps: { gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.8, 0.3] } },
      scales: { space: { steps: ['sm'], base: 2, step: 2 } },
      pins: { 'gray-b': '#111111' },
    };
    expect(mergeChain(child, lookup).pins).toEqual({ radius: '4px', 'gray-b': '#111111' });
  });

  it('keeps every inherited pin when it only inherits the ramp', () => {
    expect(mergeChain({ name: 'c', extends: 'p' }, lookup).pins).toEqual(parent.pins);
  });
});

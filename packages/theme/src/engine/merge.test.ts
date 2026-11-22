import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { axisDependencies } from './deps';
import { derive } from './derive';
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

  it("drops the parent's pins on the semantics and components it defines itself", () => {
    const child: ThemeDefinition = {
      name: 'c',
      extends: 'p',
      semantics: { radius: { value: '6px' } },
      components: { 'space-sm': '8px' },
    };
    expect(mergeChain(child, lookup).pins).toEqual({ 'gray-a': '#ffffff', 'gray-b': '#000000' });
  });

  it("fills a nested axis a child's by-axis pin leaves out from the parent's pin", () => {
    const axes = {
      mode: { default: 'dark', values: { dark: {}, light: {} } },
      density: { default: 'roomy', values: { roomy: {}, compact: {} } },
    };
    const parent: ThemeDefinition = { name: 'np', axes, pins: { p: { by: 'mode', dark: { by: 'density', compact: 'A', roomy: 'B' }, light: 'C' } } };
    const child: ThemeDefinition = { name: 'nc', extends: 'np', pins: { p: { by: 'mode', dark: { by: 'density', compact: 'X' } } } };
    const all: Record<string, ThemeDefinition> = { np: parent, nc: child };
    expect(mergeChain(child, (n) => all[n]).pins?.p).toEqual({ by: 'mode', dark: { by: 'density', compact: 'X', roomy: 'B' }, light: 'C' });
  });

  it("fills its own by-axis pin from the parent's only where it does not produce the token itself", () => {
    const axes = { mode: { default: 'dark', values: { dark: {}, light: {} } } };
    const child: ThemeDefinition = {
      name: 'c',
      extends: 'p',
      axes,
      ramps: { gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.8, 0.3] } },
      pins: { 'gray-a': { by: 'mode', dark: '#111111' }, radius: { by: 'mode', dark: '2px' } },
    };
    expect(mergeChain(child, lookup).pins).toMatchObject({
      'gray-a': { by: 'mode', dark: '#111111' },
      radius: { by: 'mode', dark: '2px', light: '4px' },
    });
    expect(mergeChain(child, lookup).pins?.['gray-a']).not.toHaveProperty('light');
  });

  it('keeps every inherited pin when it only inherits the ramp', () => {
    expect(mergeChain({ name: 'c', extends: 'p' }, lookup).pins).toEqual(parent.pins);
  });
});

describe('a theme whose ramp steps vary by axis', () => {
  const parent: ThemeDefinition = {
    name: 'p',
    axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
    ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.9, 0.2] } },
    pins: { 'gray-50': '#ffffff', 'gray-900': '#000000' },
  };
  const lookup = (name: string) => (name === 'p' ? parent : undefined);
  const gray = { kind: 'lightness' as const, lightness: [0.8, 0.3] as [number, number] };

  it('shadows only the pins on steps every branch declares', () => {
    const child = {
      name: 'c',
      extends: 'p',
      ramps: { gray: { by: 'mode', dark: { ...gray, steps: ['50'] }, light: { ...gray, steps: ['50', '900'] } } },
    } as unknown as ThemeDefinition;
    expect(mergeChain(child, lookup).pins).toEqual({ 'gray-900': '#000000' });
  });

  it('shadows the pin on a step a seed names', () => {
    const child = { name: 'c', extends: 'p', seeds: { s: '900' }, ramps: { gray: { ...gray, steps: ['50', '{seeds.s}'] } } } as unknown as ThemeDefinition;
    expect(mergeChain(child, lookup).pins).toEqual({});
  });

  it('intersects a steps list that itself varies', () => {
    const child = {
      name: 'c',
      extends: 'p',
      ramps: { gray: { ...gray, steps: { by: 'mode', dark: ['50'], light: ['50', '900'] } } },
    } as unknown as ThemeDefinition;
    expect(mergeChain(child, lookup).pins).toEqual({ 'gray-900': '#000000' });
  });
});

describe('a child entry declared at only some selections', () => {
  const axes = { mode: { default: 'dark', values: { dark: {}, light: {} } } };
  const lightness = [0.8, 0.3] as [number, number];
  const at = (def: ThemeDefinition, all: Record<string, ThemeDefinition>, mode: string) => derive(def, { mode }, (n) => all[n]);

  it('replaces an inherited ramp step only where it declares that name', () => {
    const parent: ThemeDefinition = {
      name: 'p',
      axes,
      ramps: { brand: { kind: 'lightness', steps: ['x'], lightness } },
      semantics: { accent: { ramp: 'brand', step: 'x' } },
    };
    const child = {
      name: 'c',
      extends: 'p',
      scales: { brand: { steps: { by: 'mode', dark: ['x'], light: ['z'] }, base: 4, step: 4 } },
    } as unknown as ThemeDefinition;
    const all = { p: parent, c: child };
    expect(at(child, all, 'dark').tokens['brand-x'].type).toBe('dimension');
    const light = at(child, all, 'light');
    expect(light.tokens['brand-x'].type).toBe('color');
    expect(light.tokens.accent).toBeDefined();
  });

  it('shadows an inherited semantic and pin only where it declares that name', () => {
    const parent: ThemeDefinition = {
      name: 'p',
      axes,
      semantics: { 'r-b': { value: '#123456' } },
      pins: { 'r-a': '#abcdef' },
    };
    const child = {
      name: 'c',
      extends: 'p',
      ramps: { r: { kind: 'lightness', steps: { by: 'mode', dark: ['a', 'b'], light: ['c'] }, lightness } },
    } as unknown as ThemeDefinition;
    const all = { p: parent, c: child };
    const dark = at(child, all, 'dark');
    expect(dark.issues.filter((i) => i.kind === 'invalid')).toEqual([]);
    expect(dark.provenance['r-b'].layer).toBe('ramps');
    expect(dark.provenance['r-a']).toMatchObject({ layer: 'ramps', pinned: false });
    const light = at(child, all, 'light');
    expect(light.tokens['r-b'].value).toBe('#123456');
    expect(light.tokens['r-a'].value).toBe('#abcdef');
  });

  it('counts both producers in axisDependencies', () => {
    const parent: ThemeDefinition = { name: 'p', axes, pins: { 'r-a': '#abcdef' } };
    const child = {
      name: 'c',
      extends: 'p',
      ramps: { r: { kind: 'lightness', steps: { by: 'mode', dark: ['a'], light: ['c'] }, lightness } },
    } as unknown as ThemeDefinition;
    const all: Record<string, ThemeDefinition> = { p: parent, c: child };
    expect(axisDependencies(child, (n) => all[n])['r-a'].all).toEqual(['mode']);
  });
});

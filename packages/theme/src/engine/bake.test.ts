import { describe, expect, it } from 'vitest';
import { pick, type AxisDefs } from '../axes';
import type { ThemeDefinition } from '../definition';
import { bake } from './bake';

const P: ThemeDefinition = {
  name: 'p',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  ramps: { gray: { kind: 'lightness', steps: ['50', '800'], lightness: [0.97, 0.2] } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '800', light: '50' } },
    line: { ref: 'surface', alpha: 0.2, type: 'color' },
    gap: { by: 'mode', dark: { by: 'density', comfortable: { value: '4px', type: 'dimension' }, compact: { value: '3px', type: 'dimension' } }, light: { value: '4px', type: 'dimension' } },
    glow: { by: 'mode', dark: { value: '#ffffff', type: 'color' } },
  },
  pins: { 'gray-800': '#181a1e' },
};
const defs: Record<string, ThemeDefinition> = { p: P };

describe('bake', () => {
  const baked = bake(P);

  it('keeps references and splits only what varies', () => {
    expect(baked.tokens.surface).toEqual({
      by: 'mode',
      dark: { type: 'color', value: '{gray-800}' },
      light: { type: 'color', value: '{gray-50}' },
    });
    expect(baked.tokens.line).toEqual({ type: 'color', value: '{surface}', alpha: 0.2 });
    expect(baked.tokens['gray-800']).toEqual({ type: 'color', value: '#181a1e' });
  });

  it('nests a two-axis token in axis declaration order', () => {
    expect(baked.tokens.gap).toEqual({
      by: 'mode',
      dark: { by: 'density', comfortable: { type: 'dimension', value: '4px' }, compact: { type: 'dimension', value: '3px' } },
      light: { by: 'density', comfortable: { type: 'dimension', value: '4px' }, compact: { type: 'dimension', value: '4px' } },
    });
  });

  it('leaves out a branch the definition never produced', () => {
    expect(baked.tokens.glow).toEqual({ by: 'mode', dark: { type: 'color', value: '#ffffff' } });
  });

  it('leaves out a nested branch with nothing under it', () => {
    const dim = (value: string) => ({ value, type: 'dimension' });
    const sparse: ThemeDefinition = {
      ...P,
      semantics: { gap: { by: 'mode', dark: { by: 'density', comfortable: dim('4px'), compact: dim('3px') } } },
    };
    expect(bake(sparse).tokens.gap).toEqual({
      by: 'mode',
      dark: { by: 'density', comfortable: { type: 'dimension', value: '4px' }, compact: { type: 'dimension', value: '3px' } },
    });
  });

  it('orders tokens by layer, then definition order, even where the default selection lacks one', () => {
    const halo: ThemeDefinition = {
      ...P,
      semantics: { surface: P.semantics!.surface, halo: { by: 'mode', light: { value: '#000000', type: 'color' } }, line: P.semantics!.line },
    };
    expect(Object.keys(bake(halo).tokens)).toEqual(['gray-50', 'gray-800', 'surface', 'halo', 'line']);
  });

  it('orders tokens by definition order when neighbors exist only at different selections', () => {
    const dim = (value: string) => ({ value, type: 'dimension' });
    const split: ThemeDefinition = {
      name: 's',
      axes: P.axes,
      semantics: { a: dim('1px'), b: { by: 'mode', dark: dim('1px') }, x: { by: 'mode', light: dim('1px') }, c: dim('1px') },
    };
    expect(Object.keys(bake(split).tokens)).toEqual(['a', 'b', 'x', 'c']);
  });

  it('orders ramp steps across every branch of by-varying steps', () => {
    const steps = { by: 'mode', dark: ['50', '800'], light: ['50', '900'] };
    const varied = { name: 'v', axes: P.axes, ramps: { gray: { ...P.ramps!.gray, steps } } } as unknown as ThemeDefinition;
    expect(Object.keys(bake(varied).tokens)).toEqual(['gray-50', 'gray-800', 'gray-900']);
  });

  it('serializes to JSON and back unchanged', () => {
    expect(JSON.parse(JSON.stringify(baked))).toEqual(baked);
  });

  it('keeps only what a child changes', () => {
    const child = bake({ name: 'c', extends: 'p', pins: { 'gray-800': '#222222' } }, (n) => defs[n]);
    expect(child).toMatchObject({ name: 'c', extends: 'p' });
    expect(Object.keys(child.tokens)).toEqual(['gray-800']);
    expect(child.axes).toEqual(P.axes);
  });

  describe('a child that adds an axis value', () => {
    const dim = (value: string) => ({ value, type: 'dimension' });
    const twoModes: AxisDefs = { mode: { default: 'dark', values: { dark: {}, light: {} } } };
    const threeModes: AxisDefs = { mode: { default: 'dark', values: { dark: {}, light: {}, hc: {} } } };
    const parent: ThemeDefinition = { name: 'p1', axes: twoModes, semantics: { gap: { by: 'mode', dark: dim('4'), light: dim('5') } } };
    const lookup = (n: string) => ({ p1: parent })[n];

    it('keeps a token the parent has no value for at the new value, even when it equals the parent default', () => {
      const child: ThemeDefinition = {
        name: 'c2',
        extends: 'p1',
        axes: threeModes,
        semantics: { gap: { by: 'mode', dark: dim('4'), light: dim('5'), hc: dim('4') } },
      };
      expect(pick(bake(child, lookup).tokens.gap, { mode: 'hc' })).toEqual({ ok: true, value: { type: 'dimension', value: '4' } });
    });

    it('bakes to no tokens when it overrides nothing, leaving the new value to fall through', () => {
      expect(bake({ name: 'c3', extends: 'p1', axes: threeModes }, lookup).tokens).toEqual({});
    });
  });
});

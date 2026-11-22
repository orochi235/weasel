import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { axisDependencies } from './deps';

const D: ThemeDefinition = {
  name: 'd',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  seeds: { unit: { by: 'density', comfortable: 4, compact: 3 } },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } },
  scales: { space: { steps: ['sm', 'md'], base: '{seeds.unit}', step: 4 } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '900', light: '50' } },
    line: { ref: 'surface', alpha: 0.2 },
    edge: { ramp: 'gray', contrast: { min: 3, against: ['surface'] } },
    pad: { ref: 'space-md' },
    chip: { ref: 'pad' },
    mixed: { by: 'mode', dark: { ref: 'pad' }, light: { value: '1px', type: 'dimension' } },
  },
  pins: { 'radius-md': '5px', hairline: '{line}', hatch: 'linear-gradient(var(--wzl-line) 0 1px, transparent 1px) var(--wzl-pad)' },
};

describe('axisDependencies', () => {
  const deps = axisDependencies(D);

  it('keeps the first producer of a name two entries declare, as derive does', () => {
    const def: ThemeDefinition = {
      name: 't',
      axes: D.axes,
      ramps: { text: { kind: 'lightness', steps: ['muted'], lightness: { by: 'mode', dark: [0.7, 0.7], light: [0.3, 0.3] } } },
      semantics: { 'text-muted': { value: '#000000', type: 'color' } },
    };
    expect(axisDependencies(def)['text-muted']).toEqual({ own: ['mode'], all: ['mode'] });
  });

  it('joins both producers of a name the first declares at only some selections', () => {
    const def = {
      name: 't',
      axes: D.axes,
      ramps: { text: { kind: 'lightness', steps: { by: 'mode', dark: ['muted'], light: [] }, lightness: [0.7, 0.7] } },
      semantics: { 'text-muted': { value: { by: 'density', comfortable: '#000000', compact: '#111111' }, type: 'color' } },
    } as unknown as ThemeDefinition;
    expect(axisDependencies(def)['text-muted'].own).toEqual(['mode', 'density']);
  });

  it('finds a by on the token itself, directly or through a seed', () => {
    expect(deps.surface).toEqual({ own: ['mode'], all: ['mode'] });
    expect(deps['space-md']).toEqual({ own: ['density'], all: ['density'] });
  });

  it('follows references, rule inputs and pin values', () => {
    expect(deps.line).toEqual({ own: [], all: ['mode'] });
    expect(deps.edge).toEqual({ own: [], all: ['mode'] });
    expect(deps.hairline).toEqual({ own: [], all: ['mode'] });
  });

  it('follows a var() inside a value, so a gradient over mode colors is redeclared per mode', () => {
    expect(deps.hatch).toEqual({ own: [], all: ['mode', 'density'] });
  });

  it('follows a reference written with its type group, as resolveTheme reads it', () => {
    const grouped = axisDependencies({ ...D, pins: { ...D.pins, rim: '{color.surface}' } });
    expect(grouped.rim).toEqual({ own: [], all: ['mode'] });
  });

  it('counts a token that reaches density only through a chain of references', () => {
    expect(deps.chip).toEqual({ own: [], all: ['density'] });
  });

  it('orders axes by declaration and leaves invariant tokens empty', () => {
    expect(deps.mixed).toEqual({ own: ['mode'], all: ['mode', 'density'] });
    expect(deps['radius-md']).toEqual({ own: [], all: [] });
    expect(deps['gray-50']).toEqual({ own: [], all: [] });
  });

  it('takes a pinned token’s dependencies from its pin', () => {
    const pinned = axisDependencies({ ...D, pins: { ...D.pins, surface: '#000000' } });
    expect(pinned.surface).toEqual({ own: [], all: [] });
    expect(pinned.line).toEqual({ own: [], all: [] });
  });

  it('gives a ramp whose whole lightness pair is a by on mode own: [mode] on its steps', () => {
    const varied = axisDependencies({
      ...D,
      ramps: {
        ...D.ramps,
        gray: { kind: 'lightness', steps: ['50', '900'], lightness: { by: 'mode', dark: [0.16, 0.97], light: [0.97, 0.16] } },
      },
    });
    expect(varied['gray-50']).toEqual({ own: ['mode'], all: ['mode'] });
    expect(varied['gray-900']).toEqual({ own: ['mode'], all: ['mode'] });
  });

  it('converges on a reference cycle instead of leaving mid-cycle nodes empty', () => {
    const cyclic = {
      name: 'cyclic',
      axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
      semantics: {
        A: { by: 'mode', dark: { ref: 'B' }, light: { value: '#000', type: 'color' } },
        B: { ref: 'A' },
        C: { ref: 'B' },
      },
    } as unknown as ThemeDefinition;
    const deps = axisDependencies(cyclic);
    expect(deps.A).toEqual({ own: ['mode'], all: ['mode'] });
    expect(deps.B).toEqual({ own: [], all: ['mode'] });
    expect(deps.C).toEqual({ own: [], all: ['mode'] });
  });

  it('collects step names from every branch of a by-varying ramp `steps`, and owns the by axis', () => {
    const varied = axisDependencies({
      ...D,
      ramps: {
        ...D.ramps,
        gray: { kind: 'lightness', steps: { by: 'mode', dark: ['50', '900'], light: ['50'] }, lightness: [0.97, 0.16] },
      },
    } as unknown as ThemeDefinition);
    expect(varied['gray-50']).toEqual({ own: ['mode'], all: ['mode'] });
    expect(varied['gray-900']).toEqual({ own: ['mode'], all: ['mode'] });
  });

  it('collects step names from every branch of a by-varying scale `steps`, and owns the by axis', () => {
    const varied = axisDependencies({
      ...D,
      scales: {
        ...D.scales,
        gap: { steps: { by: 'density', comfortable: ['sm'], compact: ['sm', 'md'] }, base: 4, step: 4 },
      },
    } as unknown as ThemeDefinition);
    expect(varied['gap-sm']).toEqual({ own: ['density'], all: ['density'] });
    expect(varied['gap-md']).toEqual({ own: ['density'], all: ['density'] });
  });

  it('gives step entries to a ramp whose whole entry is a by', () => {
    const lightness = (hue: number) => ({ kind: 'lightness', steps: ['50', '800'], lightness: [0.97, 0.2], hue }) as const;
    const varied = axisDependencies({
      ...D,
      ramps: { gray: { by: 'mode', dark: lightness(200), light: lightness(30) } as never },
      semantics: { surface: { ramp: 'gray', step: '800' } },
    });
    expect(varied['gray-800']).toEqual({ own: ['mode'], all: ['mode'] });
    expect(varied.surface).toEqual({ own: [], all: ['mode'] });
  });

  it('makes an offset depend on the steps of the ramp its reference sits on', () => {
    const swapped = axisDependencies({
      ...D,
      semantics: {
        surface: { ramp: 'gray', step: '900' },
        deeper: { from: 'surface', offset: 1, dir: 'darker' },
        away: { from: 'surface', offset: 1, dir: 'away' },
      },
      pins: { 'gray-50': { by: 'mode', dark: '#f5f5f6', light: '#000000' } },
    });
    expect(swapped.deeper.all).toContain('mode');
    expect(swapped.away.all).toContain('mode');
  });

  it('follows a step rule whose `step` picks a ramp step through a nested by', () => {
    const nested = axisDependencies({
      ...D,
      ramps: {
        ...D.ramps,
        gray: {
          kind: 'lightness',
          steps: ['50', '900'],
          lightness: { by: 'density', comfortable: [0.97, 0.16], compact: [0.9, 0.1] },
        },
      },
      semantics: {
        ...D.semantics,
        surface: {
          ramp: 'gray',
          step: { by: 'mode', dark: { by: 'density', comfortable: '900', compact: '50' }, light: '50' },
        },
      },
    } as unknown as ThemeDefinition);
    // Reaches every branch of the nested by (gray-900 and gray-50), which is how
    // `density` — invisible to a scan of the rule's own `step` shape's step *names* —
    // reaches `surface.all` through the ramp steps themselves.
    expect(nested.surface).toEqual({ own: ['mode', 'density'], all: ['mode', 'density'] });
  });

  it('makes step, offset and contrast rules depend on the ramp’s steps even when every step is pinned', () => {
    const hex = ['#f0f0f0', '#d0d0d0', '#a0a0a0', '#707070', '#404040', '#101010'];
    const densityRamp: ThemeDefinition = {
      name: 'dr',
      axes: { density: { default: 'a', values: { a: {}, b: {} } } },
      ramps: {
        gray: { kind: 'lightness', steps: { by: 'density', a: ['1', '2', '3', '4'], b: ['1', '2', '3', '4', '5', '6'] }, lightness: [0.95, 0.2] },
      },
      semantics: {
        surface: { ramp: 'gray', step: '3' },
        muted: { from: 'surface', offset: 1, dir: 'away' },
        deeper: { from: 'surface', offset: 1, dir: 'darker' },
        edge: { ramp: 'gray', contrast: { min: 3, against: ['surface'] } },
      },
      pins: Object.fromEntries(hex.map((h, i) => [`gray-${i + 1}`, { value: h, type: 'color' }])),
    };
    const deps = axisDependencies(densityRamp);
    expect(deps.surface.all).toEqual(['density']);
    expect(deps.muted.all).toEqual(['density']);
    expect(deps.deeper.all).toEqual(['density']);
    expect(deps.edge.all).toEqual(['density']);
    expect(deps['gray-1']).toEqual({ own: [], all: [] });
  });

  it("reads a pinned semantic's dependencies from its pin, not the rule it replaces, through an offset that references it", () => {
    const pinned = axisDependencies({
      ...D,
      pins: { ...D.pins, surface: { by: 'density', comfortable: '{gray-900}', compact: '{gray-50}' } },
      semantics: { ...D.semantics, edge: { from: 'surface', offset: 1, dir: 'away' } },
    });
    expect(pinned.edge).toEqual({ own: [], all: ['density'] });
  });

  it('leaves out a token named __proto__ or one with a character a token cannot carry, which derive refuses', () => {
    const pins = JSON.parse('{"__proto__": "1px", "a b": "2px", "a": "3px"}') as Record<string, string>;
    const deps = axisDependencies({ name: 't', pins });
    expect(Object.keys(deps)).toEqual(['a']);
    expect(Object.hasOwn(deps, '__proto__')).toBe(false);
  });

  it('lists only the steps derive gives, reading a seed that names one', () => {
    const def: ThemeDefinition = {
      name: 't',
      axes: D.axes,
      seeds: { s: { by: 'mode', dark: '500', light: '600' } },
      ramps: {
        gray: { kind: 'lightness', steps: ['{seeds.s}', '900'], lightness: [0.97, 0.16] },
        bad: { kind: 'lightness', steps: ['50', 'by'], lightness: [0.97, 0.16] },
      },
      scales: { space: { steps: ['sm', 'a b'], base: 4, step: 4 } },
    };
    const deps = axisDependencies(def);
    expect(Object.keys(deps).sort()).toEqual(['gray-500', 'gray-600', 'gray-900']);
    expect(deps['gray-500'].all).toEqual(['mode']);
  });

  it('gives an offset rule from a component the ramp the component names', () => {
    const def: ThemeDefinition = {
      name: 't',
      axes: D.axes,
      ramps: { gray: { kind: 'lightness', steps: { by: 'density', comfortable: ['50', '900'], compact: ['50', '500', '900'] }, lightness: [0.97, 0.16] } },
      components: { chip: '{gray-50}' },
      semantics: { chipRef: { ref: 'chip' }, chipHover: { from: 'chipRef', offset: 1, dir: 'away' } },
    };
    expect(axisDependencies(def).chipHover.all).toEqual(['density']);
  });

  it('makes an away offset rule depend on the steps it can land on', () => {
    const def: ThemeDefinition = {
      name: 't',
      axes: D.axes,
      ramps: { gray: { kind: 'lightness', steps: ['500', '600'], lightness: [0.6, 0.4] } },
      semantics: { accent: { ramp: 'gray', step: '500' }, hover: { from: 'accent', offset: 1, dir: 'away' } },
      pins: { 'gray-600': { by: 'density', comfortable: '#101010', compact: '#202020' } },
    };
    expect(axisDependencies(def).hover.all).toEqual(['density']);
  });

  it('joins in a component of a name whose by-axis semantic has no value at some selection', () => {
    const def: ThemeDefinition = {
      name: 'x',
      axes: {
        mode: { default: 'dark', values: { dark: {}, light: {} } },
        density: { default: 'roomy', values: { roomy: {}, compact: {} } },
      },
      semantics: { x: { by: 'mode', dark: { value: '1px', type: 'dimension' } } },
      components: { x: { by: 'density', roomy: { value: '2px', type: 'dimension' }, compact: { value: '3px', type: 'dimension' } } },
    };
    expect(axisDependencies(def).x.all).toEqual(['mode', 'density']);
  });

  it("follows a child's semantic over an inherited ramp step of its name", () => {
    const parent: ThemeDefinition = {
      name: 'rp',
      axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
      ramps: { blue: { kind: 'lightness', steps: ['500'], lightness: { by: 'mode', dark: [0.8, 0.4], light: [0.4, 0.8] } } },
    };
    const kid: ThemeDefinition = { name: 'rc', extends: 'rp', semantics: { 'blue-500': { value: '#ff0000', type: 'color' } } };
    const all: Record<string, ThemeDefinition> = { rp: parent, rc: kid };
    expect(axisDependencies(kid, (n) => all[n])['blue-500']).toEqual({ own: [], all: [] });
  });
});


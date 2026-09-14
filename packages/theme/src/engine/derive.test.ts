import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LightnessRampDef, ThemeDefinition } from '../definition';
import { toLch } from './color/oklch';
import { derive } from './derive';
import { categoricalRamp, lightnessRamp } from './ramps';

const GRAY: LightnessRampDef = { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] };

const T: ThemeDefinition = {
  name: 't',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  seeds: { unit: { by: 'density', comfortable: 4, compact: 3 } },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16], describe: { '50': 'lightest' } } },
  scales: { space: { steps: ['sm', 'md'], base: '{seeds.unit}', step: '{seeds.unit}' } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '900', light: '50' } },
    line: { ref: 'surface', alpha: 0.2, type: 'color' },
    shadow: { value: 'rgba(0, 0, 0, 0.6)', type: 'color' },
  },
  components: { 'tb-height': { value: '28px', type: 'dimension' } },
  pins: { 'gray-900': '#141820', 'radius-md': { value: '5px', type: 'dimension' } },
};

describe('derive', () => {
  it('emits in layer order, then definition order, with a pinned token left in place', () => {
    expect(Object.keys(derive(T).tokens)).toEqual([
      'gray-50', 'gray-900', 'space-sm', 'space-md', 'surface', 'line', 'shadow', 'tb-height', 'radius-md',
    ]);
  });

  it('resolves seeds per selection', () => {
    expect(derive(T, { density: 'compact' }).tokens['space-md'].value).toBe('6px');
    expect(derive(T).tokens['space-md'].value).toBe('8px');
  });

  it('points a step semantic at the ramp token for the selection', () => {
    expect(derive(T).tokens.surface.value).toBe('{gray-900}');
    expect(derive(T, { mode: 'light' }).tokens.surface.value).toBe('{gray-50}');
    expect(derive(T).tokens.line).toMatchObject({ value: '{surface}', alpha: 0.2 });
  });

  it('records what a pin overrode, and treats a pin with nothing under it as authored', () => {
    const { tokens, provenance } = derive(T);
    expect(tokens['gray-900'].value).toBe('#141820');
    expect(provenance['gray-900']).toMatchObject({ layer: 'ramps', rule: 'lightness', pinned: true });
    expect(provenance['gray-900'].generated?.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(provenance['radius-md']).toEqual({ layer: 'pins', rule: 'value', pinned: false });
    expect(tokens['gray-50'].description).toBe('lightest');
  });

  it('reports an untyped pin and a missing axis value without throwing', () => {
    // `edge` is referenced by nothing, so leaving it underived dangles no reference.
    const { issues } = derive(
      { ...T, pins: { ...T.pins, loose: '1px' }, semantics: { ...T.semantics, edge: { ramp: 'gray', step: { by: 'mode', dark: '900' } } } },
      { mode: 'light' },
    );
    expect(issues).toContainEqual({ kind: 'untyped-pin', token: 'loose' });
    expect(issues).toContainEqual({ kind: 'missing-axis-value', path: 'semantics.edge.step', axis: 'mode', value: 'light' });
  });

  it('throws on a dangling reference', () => {
    expect(() => derive({ ...T, pins: { a: { value: '{nope}', type: 'color' } } })).toThrow(/nope/);
  });

  it('derives the fixture with no issues', () => {
    expect(derive(T).issues).toEqual([]);
  });

  it('reports a semantic missing its axis value instead of throwing on what references it', () => {
    const { tokens, issues } = derive(
      { name: 'x', axes: T.axes, ramps: { gray: GRAY }, semantics: { surface: { ramp: 'gray', step: { by: 'mode', dark: '900' } }, line: { ref: 'surface', alpha: 0.2 } } },
      { mode: 'light' },
    );
    expect(issues).toEqual([{ kind: 'missing-axis-value', path: 'semantics.surface.step', axis: 'mode', value: 'light' }]);
    expect(tokens.line.value).toBe('{surface}');
  });

  it('reports a ramp parameter missing its axis value instead of throwing on the steps referenced', () => {
    const { tokens, issues } = derive(
      { name: 'x', axes: T.axes, ramps: { gray: { ...GRAY, lightness: [{ by: 'mode', dark: 0.97 }, 0.16] } }, semantics: { surface: { ramp: 'gray', step: '900' } } },
      { mode: 'light' },
    );
    expect(issues).toEqual([{ kind: 'missing-axis-value', path: 'ramps.gray.lightness.0', axis: 'mode', value: 'light' }]);
    expect(Object.keys(tokens)).toEqual(['surface']);
  });

  it('throws on a reference that dangles only at this selection', () => {
    const def = {
      name: 'x',
      axes: T.axes,
      ramps: { gray: { ...GRAY, steps: { by: 'mode', dark: ['50', '900'], light: ['50'] } } },
      pins: { a: { value: '{gray-900}', type: 'color' } },
    } as unknown as ThemeDefinition;
    expect(derive(def).issues).toEqual([]);
    expect(() => derive(def, { mode: 'light' })).toThrow(/gray-900/);
  });

  it('does not report a pin untyped when what it references is already reported missing', () => {
    const { issues } = derive(
      {
        name: 'x',
        axes: T.axes,
        ramps: { gray: GRAY },
        semantics: { surface: { ramp: 'gray', step: { by: 'mode', dark: '900' } } },
        components: { c: { by: 'mode', dark: '1px' } },
        pins: { p: '{surface}', q: '{c}' },
      },
      { mode: 'light' },
    );
    expect(issues).toEqual([
      { kind: 'missing-axis-value', path: 'semantics.surface.step', axis: 'mode', value: 'light' },
      { kind: 'missing-axis-value', path: 'components.c', axis: 'mode', value: 'light' },
    ]);
  });

  it('types a pin over a ref semantic from what the ref reaches, and records that type as generated', () => {
    const over = (pin: string) =>
      derive({ name: 'x', semantics: { h: { ref: 'tb' } }, components: { tb: { value: '28px', type: 'dimension' } }, pins: { h: pin } });
    const literal = over('30px');
    expect(literal.issues).toEqual([]);
    expect(literal.tokens.h.type).toBe('dimension');
    expect(literal.provenance.h.generated?.type).toBe('dimension');
    expect(over('{tb}').provenance.h.generated?.type).toBe('dimension');
  });

  it('types a long chain of references', () => {
    const pins: Record<string, string> = { p5000: '1px' };
    for (let i = 0; i < 5000; i++) pins[`p${i}`] = `{p${i + 1}}`;
    const { tokens, issues } = derive({ name: 'x', pins: { ...pins, p5000: { value: '1px', type: 'dimension' } } });
    expect(issues).toEqual([]);
    expect(tokens.p0.type).toBe('dimension');
  });

  it('settles only rule parameters, leaving descriptions as written', () => {
    const { tokens, issues } = derive({
      name: 'x',
      ramps: { gray: { ...GRAY, description: '{seeds.nope}', describe: { '50': '{seeds.nope}' } } },
    });
    expect(issues).toEqual([]);
    expect(tokens['gray-50'].description).toBe('{seeds.nope}');
  });

  it('reserves "by" as a step name', () => {
    const { tokens, issues } = derive({
      name: 'x',
      ramps: { gray: { ...GRAY, steps: ['by', '900'] } },
      scales: { space: { steps: ['sm', 'by'], base: 4, step: 4 } },
    });
    expect(issues).toEqual([
      { kind: 'invalid', path: 'ramps.gray.steps', message: '"by" is reserved and cannot name a step' },
      { kind: 'invalid', path: 'scales.space.steps', message: '"by" is reserved and cannot name a step' },
    ]);
    expect(tokens).toEqual({});
  });

  it('exempts only the steps of this branch when a ramp fails after its steps settle', () => {
    const def = {
      name: 'x',
      axes: T.axes,
      ramps: { gray: { ...GRAY, steps: { by: 'mode', dark: ['50', '900'], light: ['50'] }, lightness: { by: 'mode', dark: [0.97, 0.16], light: 'oops' } } },
      pins: { a: { value: '{gray-900}', type: 'color' } },
    } as unknown as ThemeDefinition;
    expect(derive(def).issues).toEqual([]);
    expect(() => derive(def, { mode: 'light' })).toThrow(/gray-900/);
  });

  it('reports an untyped chain once, at its end', () => {
    expect(derive({ name: 'x', pins: { a: '{b}', b: '{c}', c: '1px' } }).issues).toEqual([{ kind: 'untyped-pin', token: 'c' }]);
    expect(derive({ name: 'x', semantics: { s: { ref: 'c' } }, pins: { a: '{s}', c: '1px' } }).issues).toEqual([{ kind: 'untyped-pin', token: 'c' }]);
  });

  it('does not report an untyped pin over a semantic whose rule failed', () => {
    const { issues } = derive({ name: 'x', ramps: { gray: GRAY }, semantics: { fg: { ramp: 'gray', step: '850' } }, pins: { fg: '#000000' } });
    expect(issues).toEqual([{ kind: 'invalid', path: 'semantics.fg', message: 'no such step on ramp "gray"' }]);
  });

  it('types through a rule that loops back through pins', () => {
    const { tokens, issues } = derive({ name: 'x', semantics: { B: { ref: 'C' } }, pins: { A: '{B}', B: { value: '1px', type: 'dimension' }, C: '{A}' } });
    expect(issues).toEqual([]);
    expect([tokens.A.type, tokens.C.type]).toEqual(['dimension', 'dimension']);
  });

  it('reports an entry that is not an object', () => {
    const loaded: ThemeDefinition = JSON.parse(
      '{ "name": "x", "ramps": { "gray": null, "blue": 5 }, "scales": { "space": "abc" }, "semantics": { "s": null } }',
    );
    const { tokens, issues } = derive(loaded);
    expect(issues).toEqual([
      { kind: 'invalid', path: 'ramps.gray', message: 'expected an object' },
      { kind: 'invalid', path: 'ramps.blue', message: 'expected an object' },
      { kind: 'invalid', path: 'scales.space', message: 'expected an object' },
      { kind: 'invalid', path: 'semantics.s', message: 'expected an object' },
    ]);
    expect(tokens).toEqual({});
  });

  it('throws on a reference cycle', () => {
    expect(() => derive({ name: 'x', pins: { a: { value: '{b}', type: 'color' }, b: { value: '{a}', type: 'color' } } })).toThrow(/cycle/);
  });

  it('checks references without resolving colors', () => {
    const def: ThemeDefinition = {
      name: 'x',
      ramps: { gray: GRAY },
      semantics: { s: { ramp: 'gray', step: '900' }, line: { ref: 's', alpha: 0.2 } },
      pins: { 'gray-900': 'rgb(1, 2, 3)' },
    };
    expect(derive(def).issues).toEqual([]);
  });

  it('types a pin, component or literal from a token defined after it', () => {
    const later = derive({ name: 'x', pins: { a: '{b}', b: { value: '1px', type: 'dimension' } } });
    expect(later.issues).toEqual([]);
    expect(later.tokens.a.type).toBe('dimension');

    const component = derive({ name: 'x', components: { c: '{b}' }, pins: { b: { value: '1px', type: 'dimension' } } });
    expect(component.issues).toEqual([]);
    expect(component.tokens.c.type).toBe('dimension');

    const semantic = derive({ name: 'x', ramps: { gray: GRAY }, semantics: { s: { value: '{gray-50}' }, h: { ref: 'tb' } }, components: { tb: { value: '28px', type: 'dimension' } } });
    expect(semantic.issues).toEqual([]);
    expect(semantic.tokens.s.type).toBe('color');
    expect(semantic.tokens.h.type).toBe('dimension');
  });

  it('picks a by above a whole ramp parameter', () => {
    const steps = ['50', '500', '900'];
    const def: ThemeDefinition = {
      name: 'x',
      axes: T.axes,
      ramps: {
        gray: {
          kind: 'lightness',
          steps,
          lightness: { by: 'mode', dark: [0.97, 0.16], light: [0.9, 0.2] },
          chroma: { by: 'mode', dark: { peak: 0.1 }, light: { peak: 0 } },
        },
      },
    };
    const want = (lightness: [number, number], peak: number) =>
      lightnessRamp({ steps, lightness, curve: 0, hue: 0, peak, darkBias: 0 })['500'];
    const dark = derive(def);
    const light = derive(def, { mode: 'light' });
    expect([...dark.issues, ...light.issues]).toEqual([]);
    expect(dark.tokens['gray-500'].value).toBe(want([0.97, 0.16], 0.1));
    expect(light.tokens['gray-500'].value).toBe(want([0.9, 0.2], 0));
    expect(want([0.97, 0.16], 0.1)).not.toBe(want([0.97, 0.16], 0));
  });

  it('picks a by above the whole gates without leaking its keys', () => {
    const steps = ['a', 'b', 'c'];
    const def: ThemeDefinition = {
      name: 'x',
      axes: T.axes,
      ramps: { sw: { kind: 'categorical', steps, gates: { by: 'mode', dark: { lightnessTarget: 0.5 }, light: {} } } },
    };
    const { tokens, issues } = derive(def);
    expect(issues).toEqual([]);
    const want = categoricalRamp(steps, { lightnessTarget: 0.5 }, []).colors;
    expect(want).not.toEqual(categoricalRamp(steps, {}, []).colors);
    expect(steps.map((s) => tokens[`sw-${s}`].value)).toEqual(steps.map((s) => want[s]));
  });

  it('reports a by above a parameter missing its value, at its path', () => {
    const { tokens, issues } = derive(
      { name: 'x', axes: T.axes, ramps: { gray: { ...GRAY, lightness: { by: 'mode', dark: [0.97, 0.16] } } } },
      { mode: 'light' },
    );
    expect(issues).toEqual([{ kind: 'missing-axis-value', path: 'ramps.gray.lightness', axis: 'mode', value: 'light' }]);
    expect(tokens).toEqual({});
  });

  it('reports settled parameters of the wrong type', () => {
    const { tokens, issues } = derive({
      name: 'x',
      seeds: { s: 'abc' },
      ramps: { sw: { kind: 'categorical', steps: ['a'], gates: { minContrast: '{seeds.s}', nope: 1 } } },
      scales: { space: { steps: ['sm'], base: '{seeds.s}', step: 4 } },
    });
    expect(issues).toEqual([
      { kind: 'invalid', path: 'ramps.sw.gates.minContrast', message: 'expected a number' },
      { kind: 'invalid', path: 'ramps.sw.gates.nope', message: 'unknown gate' },
      { kind: 'invalid', path: 'scales.space.base', message: 'expected a number' },
    ]);
    expect(tokens).toEqual({});
  });

  it('reports a lightness ramp loaded without lightness instead of crashing', () => {
    const loaded: ThemeDefinition = JSON.parse('{ "name": "x", "ramps": { "accent": { "kind": "lightness", "steps": ["base"] } } }');
    expect(derive(loaded).issues).toEqual([{ kind: 'invalid', path: 'ramps.accent.lightness', message: 'expected two numbers' }]);
  });

  it('reports a name two entries both produce, keeping the first', () => {
    const { tokens, provenance, issues } = derive({ name: 'x', ramps: { gray: GRAY }, semantics: { 'gray-50': { value: '#fff', type: 'color' } } });
    expect(issues).toEqual([{ kind: 'invalid', path: 'semantics.gray-50', message: '"gray-50" is already produced by ramps.gray' }]);
    expect(provenance['gray-50'].layer).toBe('ramps');
    expect(tokens['gray-50'].value).not.toBe('#fff');
  });

  it('reports a token name containing a dot and produces nothing under it', () => {
    const { tokens, issues } = derive({
      name: 'x',
      ramps: { 'g.r': GRAY },
      scales: { space: { steps: ['a.b'], base: 4, step: 4 } },
      semantics: { 's.x': { value: '#ffffff', type: 'color' } },
      components: { 'c.x': { value: '1px', type: 'dimension' } },
      pins: { 'p.x': { value: '2px', type: 'dimension' } },
    });
    expect(Object.keys(tokens).filter((n) => n.includes('.'))).toEqual([]);
    const paths = issues.filter((i) => i.kind === 'invalid').map((i) => (i as { path: string }).path);
    expect(paths).toEqual(expect.arrayContaining(['ramps.g.r', 'scales.space.steps', 'semantics.s.x', 'components.c.x', 'pins.p.x']));
  });

  it('reports a token name with a character a CSS variable or the generated module cannot carry', () => {
    const { tokens, issues } = derive({ name: 'x', pins: { "a'b": { value: '2px', type: 'dimension' } } });
    expect(issues).toEqual([
      { kind: 'invalid', path: "pins.a'b", message: `"a'b" cannot name a token: use letters, digits, "-" and "_"` },
    ]);
    expect(tokens).toEqual({});
  });

  it('reports a step name with a character a token name cannot carry', () => {
    const { tokens, issues } = derive({ name: 'x', ramps: { gray: { ...GRAY, steps: ['x y', '900'] } } });
    expect(issues).toEqual([
      { kind: 'invalid', path: 'ramps.gray.steps', message: `"x y" cannot name a token: use letters, digits, "-" and "_"` },
    ]);
    expect(tokens).toEqual({});
  });

  it('reports a seed missing its axis value once, not again where it is read', () => {
    const { issues } = derive(
      { name: 'x', axes: T.axes, seeds: { unit: { by: 'mode', dark: 4 } }, scales: { space: { steps: ['sm'], base: '{seeds.unit}', step: 4 } } },
      { mode: 'light' },
    );
    expect(issues).toEqual([{ kind: 'missing-axis-value', path: 'seeds.unit', axis: 'mode', value: 'light' }]);
  });

  it('reports a seed nothing declares', () => {
    const { issues } = derive({ name: 'x', scales: { space: { steps: ['sm'], base: '{seeds.unit}', step: 4 } } });
    expect(issues).toEqual([{ kind: 'invalid', path: 'scales.space.base', message: 'unknown seed "unit"' }]);
  });

  it('resolves a whole-value seed reference in a pin or a component, per selection', () => {
    const def: ThemeDefinition = {
      name: 'x',
      axes: T.axes,
      seeds: { brand: '#112233', bg: { by: 'mode', dark: '#000000', light: '#ffffff' } },
      components: { chip: { value: '{seeds.brand}', type: 'color' } },
      pins: { brand: '{seeds.brand}', ground: { value: '{seeds.bg}', type: 'color' } },
    };
    const dark = derive(def);
    expect(dark.issues).toEqual([{ kind: 'untyped-pin', token: 'brand' }]);
    expect(dark.tokens.brand.value).toBe('#112233');
    expect(dark.tokens.chip.value).toBe('#112233');
    expect(derive(def, { mode: 'light' }).tokens.ground.value).toBe('#ffffff');
  });

  it('measures contrast against a pin that names a seed', () => {
    const { tokens, issues } = derive({
      name: 'x',
      seeds: { bg: '#000000' },
      ramps: { gray: GRAY },
      semantics: { fg: { ramp: 'gray', contrast: { min: 4.5, against: ['ground'] } } },
      pins: { ground: { value: '{seeds.bg}', type: 'color' } },
    });
    expect(issues).toEqual([]);
    expect(tokens.fg.value).toBe('{gray-50}');
  });

  it('reports a seed nothing declares in a pin', () => {
    const { tokens, issues } = derive({ name: 'x', pins: { brand: { value: '{seeds.nope}', type: 'color' } } });
    expect(issues).toEqual([{ kind: 'invalid', path: 'pins.brand', message: 'unknown seed "nope"' }]);
    expect(tokens.brand).toBeUndefined();
  });

  it('reports a categorical ramp whose gates cannot be met', () => {
    const steps = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const { issues } = derive({
      name: 'x',
      ramps: { swatch: { kind: 'categorical', steps, gates: { hueFloor: (40 * 12) / 360, minDistance: 0, minSurfaceDistance: 0 } } },
    });
    expect(issues).toContainEqual({ kind: 'infeasible-ramp', ramp: 'swatch' });
  });

  it('reads chroma.lightBias, so an anchored ramp keeps chroma at both ends', () => {
    const ramp = (chroma?: LightnessRampDef['chroma']) => ({
      name: 't',
      ramps: { accent: { kind: 'lightness' as const, steps: ['soft', 'base', 'strong'], lightness: [0.72, 0.34] as [number, number], anchor: { base: '#0b6e8a' }, ...(chroma ? { chroma } : {}) } },
    });
    const C = (def: ReturnType<typeof ramp>, step: string) => toLch(String(derive(def).tokens[`accent-${step}`].value)).C;
    expect(C(ramp(), 'soft')).toBeLessThan(0.005);
    const biased = ramp({ peak: 0, lightBias: 1, darkBias: 1 });
    expect(C(biased, 'soft')).toBeGreaterThan(0.02);
    expect(C(biased, 'strong')).toBeGreaterThan(0.02);
  });
});

it("generates a child's own gray over weasel's pinned one", () => {
  const themes = resolve(dirname(fileURLToPath(import.meta.url)), '../../themes');
  const weasel = JSON.parse(readFileSync(resolve(themes, 'weasel.json'), 'utf8')) as ThemeDefinition;
  const child: ThemeDefinition = { name: 'c', extends: 'weasel', ramps: { gray: weasel.ramps!.gray } };
  const result = derive(child, { mode: 'dark' }, (n) => (n === 'weasel' ? weasel : undefined));
  expect(result.tokens['gray-800'].value).toBe('#1a1c21');
  expect(result.provenance['gray-800'].pinned).toBe(false);
  expect(result.tokens['accent-base'].value).toBe(derive(weasel, { mode: 'dark' }).tokens['accent-base'].value);
});

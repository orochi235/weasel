/**
 * fast-check arbitraries for whole theme definitions, shared by the engine's property tests: ramps, scales, seeds,
 * semantics of every rule kind, components, and pins over small name pools, so references hit, miss, and loop, and
 * some names are `Object.prototype` members. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { AxisDefs, Varying } from '../axes';
import type { PinValue, SemanticRule, ThemeDefinition } from '../definition';

export const AXES: AxisDefs = {
  mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
  density: { default: 'compact', values: { compact: {}, roomy: {} } },
};

const RAMPS = ['gray', 'blue', 'toString'] as const;
const STEPS = ['50', '100', '500', '900'] as const;
const SEMANTICS = ['surface', 'text', 'line', 'accent', 'constructor'] as const;
const COMPONENTS = ['tb', 'chip'] as const;
const PIN_ONLY = ['loose', 'valueOf'] as const;

/** Every name a definition here can produce or reference. */
export const NAMES = [
  ...RAMPS.flatMap((r) => STEPS.map((s) => `${r}-${s}`)),
  'space-sm', 'space-md',
  ...SEMANTICS, ...COMPONENTS, ...PIN_ONLY,
];
const name = fc.constantFrom(...NAMES);

/** `leaf`, or a `by` over one axis naming every value (usually) or only some. */
export function byAxis<T>(leaf: fc.Arbitrary<T>, axes: AxisDefs = AXES): fc.Arbitrary<Varying<T>> {
  return fc.oneof(
    { weight: 3, arbitrary: leaf },
    {
      weight: 2,
      arbitrary: fc.constantFrom(...Object.keys(axes)).chain((axis) => {
        const all = Object.keys(axes[axis]!.values);
        return fc.oneof({ weight: 4, arbitrary: fc.constant(all) }, { weight: 1, arbitrary: fc.subarray(all) }).chain((vs) =>
          fc.tuple(...vs.map(() => leaf)).map((xs) => ({ by: axis, ...Object.fromEntries(vs.map((v, i) => [v, xs[i]])) }) as Varying<T>),
        );
      }),
    },
  );
}

const hex = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map((cs) => `#${cs.map((c) => c.toString(16).padStart(2, '0')).join('')}`);
const unit = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const steps = fc.subarray([...STEPS], { minLength: 2 });

const lightnessRamp = fc.record({
  kind: fc.constant('lightness' as const),
  steps: byAxis(steps),
  lightness: byAxis(fc.tuple(fc.oneof(unit, fc.constant('{seeds.top}')), unit)),
  hue: fc.option(fc.oneof(fc.integer({ min: 0, max: 360 }), fc.constant('{seeds.hue}')), { nil: undefined }),
  chroma: fc.option(fc.record({ peak: fc.integer({ min: 0, max: 30 }).map((n) => n / 100) }), { nil: undefined }),
  anchor: fc.option(fc.dictionary(fc.constantFrom(...STEPS), hex, { maxKeys: 1 }), { nil: undefined }),
}, { requiredKeys: ['kind', 'steps', 'lightness'] });

const scaleDef = fc.record({
  steps: fc.constant(['sm', 'md']),
  base: byAxis(fc.oneof(fc.integer({ min: 0, max: 16 }), fc.constant('{seeds.unit}'))),
  step: fc.integer({ min: 0, max: 8 }),
});

const ramp = fc.constantFrom(...RAMPS);
const rule: fc.Arbitrary<SemanticRule> = fc.oneof(
  fc.record({ ramp, step: byAxis(fc.constantFrom(...STEPS)) }),
  fc.record({ ref: name, alpha: fc.option(fc.constantFrom(0.5, 0.25), { nil: undefined }) }, { requiredKeys: ['ref'] }),
  fc.record({ from: name, offset: fc.integer({ min: 0, max: 3 }), dir: fc.constantFrom('lighter' as const, 'darker' as const, 'away' as const) }),
  fc.record({ ramp, contrast: fc.record({ min: fc.constantFrom(1, 3, 4.5, 7, 22), against: fc.subarray(NAMES, { minLength: 1, maxLength: 2 }) }) }),
  fc.record({ value: hex, type: fc.constant('color') }),
) as fc.Arbitrary<SemanticRule>;

const pinValue: fc.Arbitrary<PinValue> = fc.oneof(
  hex,
  name.map((n) => `{${n}}`),
  fc.constantFrom('4px', '{seeds.hue}'),
  fc.record({ value: fc.oneof(hex, name.map((n) => `{${n}}`)), type: fc.constant('color'), alpha: fc.option(fc.constant(0.5), { nil: undefined }) }, { requiredKeys: ['value'] }),
);

/**
 * Pins a literal for every name of the pools that nothing in `def` declares, except the steps of a ramp it declares,
 * so fewer references dangle.
 */
function filled(def: ThemeDefinition): ThemeDefinition {
  const declared = new Set([
    ...Object.keys(def.semantics ?? {}), ...Object.keys(def.components ?? {}), ...Object.keys(def.pins ?? {}),
    ...Object.keys(def.ramps ?? {}).flatMap((r) => STEPS.map((s) => `${r}-${s}`)),
    ...Object.keys(def.scales ?? {}).flatMap((sc) => ['sm', 'md'].map((s) => `${sc}-${s}`)),
  ]);
  const extra = Object.fromEntries(NAMES.filter((n) => !declared.has(n)).map((n) => [n, { value: '#808080', type: 'color' }]));
  return { ...def, pins: { ...extra, ...def.pins } };
}

/** A definition named `name` over {@link AXES}, every layer optional; half of them pin whatever else would dangle. */
export function definition(themeName = 't'): fc.Arbitrary<ThemeDefinition> {
  return fc.tuple(bareDefinition(themeName), fc.boolean()).map(([def, fill]) => (fill ? filled(def) : def));
}

function bareDefinition(themeName: string): fc.Arbitrary<ThemeDefinition> {
  return fc.record({
    name: fc.constant(themeName),
    axes: fc.constant(AXES),
    seeds: fc.record({ hue: byAxis(fc.integer({ min: 0, max: 360 })), unit: byAxis(fc.integer({ min: 1, max: 6 })), top: byAxis(unit) }),
    ramps: fc.dictionary(ramp, lightnessRamp, { maxKeys: 3 }),
    scales: fc.dictionary(fc.constant('space'), scaleDef, { maxKeys: 1 }),
    semantics: fc.dictionary(fc.constantFrom(...SEMANTICS), byAxis(rule), { maxKeys: 5 }),
    components: fc.dictionary(fc.constantFrom(...COMPONENTS), byAxis(pinValue), { maxKeys: 2 }),
    pins: fc.dictionary(name, byAxis(pinValue), { maxKeys: 3 }),
  }) as fc.Arbitrary<ThemeDefinition>;
}

/** The errors `derive` documents throwing: a reference cycle or a dangling reference. Anything else is a bug. */
export const DOCUMENTED_THROW = /cycle|which is not defined/;

/** `value` frozen all the way down, so a function that writes to its input throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

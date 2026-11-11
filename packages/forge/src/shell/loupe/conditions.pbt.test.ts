/**
 * A lens's comparison: opposite mode flips light and dark (App and auto read through the lab and the OS) and is
 * its own inverse, leaving a mode with no opposite as it is; a custom comparison lays its globals over the base and
 * names each one; and naming a comparison never throws, whatever its globals and the mode are called, names every
 * `Object.prototype` member answers to included.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROTO_KEYS, key, runs, tally, text } from '../../pbt.fixture';
import { FOLLOW_APP, type GlobalDeclarations } from '../globals';
import { describeComparison, type ForgeComparison, oppositeMode, type ResolveContext, resolveComparison } from './conditions';

const RUNS = 300;

const DECLARATIONS: GlobalDeclarations = {
  mode: { label: 'Mode', default: 'auto', options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] },
  theme: { label: 'Theme', default: 'paper', options: [{ value: 'paper', label: 'Paper' }] },
};

const modeValue = fc.constantFrom('light', 'dark', 'auto', FOLLOW_APP, 'sepia', '', ...PROTO_KEYS);
const context: fc.Arbitrary<ResolveContext> = fc.record({
  declarations: fc.constant(DECLARATIONS),
  modeGlobal: fc.constantFrom('mode', ...PROTO_KEYS),
  prefersDark: fc.boolean(),
  labMode: fc.constantFrom('light', 'dark', 'auto'),
});

const shown = (value: string, ctx: ResolveContext): string => {
  const followed = value === FOLLOW_APP ? ctx.labMode : value;
  return followed === 'auto' ? (ctx.prefersDark ? 'dark' : 'light') : followed;
};

function setOwn(target: Record<string, string>, k: string, value: string): Record<string, string> {
  Object.defineProperty(target, k, { value, enumerable: true, writable: true, configurable: true });
  return target;
}

describe('opposite mode', () => {
  it('flips light and dark as the story shows them, is its own inverse, and leaves any other mode alone', () => {
    const seen = tally();
    fc.assert(
      fc.property(context, modeValue, (ctx, mode) => {
        const base = setOwn({ theme: 'paper' }, ctx.modeGlobal, mode);
        const { from, to } = oppositeMode(base, ctx);
        expect(from).toBe(shown(mode, ctx));
        const flipped = resolveComparison({ kind: 'opposite-mode' }, base, ctx);
        if (from === 'light' || from === 'dark') {
          expect(to).toBe(from === 'light' ? 'dark' : 'light');
          expect(flipped.globals[ctx.modeGlobal]).toBe(to);
          expect(resolveComparison({ kind: 'opposite-mode' }, flipped.globals, ctx).globals[ctx.modeGlobal]).toBe(from);
          seen.count('flipped');
        } else {
          expect(to).toBeUndefined();
          expect(flipped.globals).toBe(base);
          seen.count('kept');
        }
        expect(flipped.args).toEqual({});
        expect(flipped.dpr).toBeNull();
      }),
      runs(RUNS),
    );
    seen.atLeast('flipped', 50);
    seen.atLeast('kept', 50);
  });
});

describe('custom comparison', () => {
  const globals = fc.array(fc.tuple(key, text), { maxLength: 3 }).map((pairs) => pairs.reduce<Record<string, string>>((o, [k, v]) => setOwn(o, k, v), {}));
  const comparison: fc.Arbitrary<ForgeComparison> = fc.record(
    { kind: fc.constant('custom' as const), globals, args: fc.dictionary(key, fc.oneof(fc.integer(), text)), dpr: fc.constantFrom(1, 2, 3) },
    { requiredKeys: ['kind'] },
  );

  it('lays its globals over the base and keeps its args and DPR', () => {
    fc.assert(
      fc.property(comparison, globals, context, (c, base, ctx) => {
        if (c.kind !== 'custom') return;
        const got = resolveComparison(c, base, ctx);
        const expected: Record<string, string> = {};
        for (const [k, v] of [...Object.entries(base), ...Object.entries(c.globals ?? {})]) setOwn(expected, k, v);
        expect(got.globals).toEqual(expected);
        expect(Object.keys(got.globals).sort()).toEqual(Object.keys(expected).sort());
        expect(got.args).toEqual(c.args ?? {});
        expect(got.dpr).toBe(c.dpr ?? null);
      }),
      runs(RUNS),
    );
  });

  it('names every global, arg, and DPR it sets, and never throws on any name', () => {
    fc.assert(
      fc.property(comparison, context, modeValue, fc.boolean(), (c, ctx, mode, pixels) => {
        const base = setOwn({}, ctx.modeGlobal, mode);
        const name = describeComparison(c, DECLARATIONS, { base, ctx, pixels });
        const opposite = describeComparison({ kind: 'opposite-mode' }, DECLARATIONS, { base, ctx, pixels });
        expect(typeof opposite).toBe('string');
        if (c.kind !== 'custom') return;
        for (const [k, v] of Object.entries(c.globals ?? {})) {
          const declared = Object.hasOwn(DECLARATIONS, k) ? DECLARATIONS[k]! : undefined;
          const option = declared?.options.find((o) => o.value === v);
          expect(name).toContain(declared ? `${declared.label}: ${option?.label ?? v}` : `${k}: ${v}`);
        }
        for (const k of Object.keys(c.args ?? {})) expect(name).toContain(`Arg ${k} = `);
        if (c.dpr) expect(name).toContain(`DPR ${c.dpr}×`);
        if (Object.keys(c.globals ?? {}).length + Object.keys(c.args ?? {}).length === 0 && !c.dpr) expect(name).toBe('As it is');
      }),
      runs(RUNS),
    );
  });
});

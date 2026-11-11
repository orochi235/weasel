/**
 * Property tests of icon names and specs: qualifying and splitting round-trip, a run-time string reads as a
 * ref exactly when it splits, and a spec read from any JSON value is either none or made of refs.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { qualify, scopedIcon, splitIconRef, toIconRef } from './names';
import { iconParts, iconSpecRefs, toIconSpec, type IconSpec } from './spec';
import { anyText, part, runs, timeoutFor } from './pbt.fixture';
import type { IconRef } from './names';

describe('names', () => {
  it('splits what qualify built back into its halves, and qualify keeps a qualified name', () => {
    fc.assert(fc.property(part, part, part, (ns, name, other) => {
      const ref = qualify(ns, name);
      expect(splitIconRef(ref)).toEqual({ namespace: ns, name });
      expect(qualify(other, ref)).toBe(ref);
      expect(toIconRef(ref)).toBe(ref);
      expect(scopedIcon(ns)(name as never)).toBe(ref);
    }), runs(300));
  }, timeoutFor(300, 1));

  it('reads any string as a ref exactly when it splits, and a split joins back to the string', () => {
    let refs = 0;
    let not = 0;
    fc.assert(fc.property(anyText, (s) => {
      const split = splitIconRef(s);
      expect(toIconRef(s)).toBe(split ? s : undefined);
      if (split) {
        refs++;
        expect(`${split.namespace}:${split.name}`).toBe(s);
        expect(split.namespace).not.toMatch(/[:\s]/);
        expect(split.name).not.toMatch(/[:\s]/);
        expect(split.namespace.length * split.name.length).toBeGreaterThan(0);
      } else not++;
    }), runs(500));
    expect(refs).toBeGreaterThan(20);
    expect(not).toBeGreaterThan(20);
  }, timeoutFor(500, 1));
});

const spec: fc.Arbitrary<IconSpec> = fc.oneof(
  fc.tuple(part, part).map(([a, b]) => `${a}:${b}` as IconRef),
  fc.record({ name: fc.tuple(part, part).map(([a, b]) => `${a}:${b}` as IconRef) }),
  fc.record({
    name: fc.tuple(part, part).map(([a, b]) => `${a}:${b}` as IconRef),
    mark: fc.tuple(part, part).map(([a, b]) => `${a}:${b}` as IconRef),
  }),
);

describe('specs', () => {
  it('reads a spec back as itself, its refs subject first', () => {
    fc.assert(fc.property(spec, (s) => {
      const read = toIconSpec(JSON.parse(JSON.stringify(s)));
      expect(iconParts(read)).toEqual(iconParts(s));
      const parts = iconParts(s)!;
      expect(iconSpecRefs(s)).toEqual(parts.mark ? [parts.name, parts.mark] : [parts.name]);
    }), runs(300));
  }, timeoutFor(300, 1));

  it('reads any JSON value as none or as a spec every ref of which is qualified', () => {
    let some = 0;
    const value = fc.oneof(
      fc.jsonValue({ maxDepth: 2 }),
      fc.record({ name: fc.oneof(anyText, fc.jsonValue({ maxDepth: 1 })) }, { requiredKeys: [] }),
      fc.record({ name: anyText, mark: fc.oneof(anyText, fc.jsonValue({ maxDepth: 1 })) }, { requiredKeys: [] }),
      anyText,
    );
    fc.assert(fc.property(value, (v) => {
      const read = toIconSpec(v);
      if (read === undefined) return;
      some++;
      const refs = iconSpecRefs(read);
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(toIconRef(r)).toBe(r);
    }), runs(500));
    expect(some).toBeGreaterThan(20);
  }, timeoutFor(500, 1));
});

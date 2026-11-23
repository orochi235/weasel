import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import type { PrefLeaf, PrefObject } from './schema';
import { applyPrefConditions, applyPrefEntryConditions, prefJudge, prefReader, prefStatusAt } from './status';
import type { PrefUnion } from './union';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const variant = (children: PrefObject['children']): PrefObject => ({ kind: 'object', name: 'V', description: '', default: {}, children });
const locked = { path: 'lock', is: false } as const;
const fill: PrefUnion = {
  kind: 'union', name: 'Fill', description: '', default: { type: 'linear', angle: 0 }, tag: 'type',
  variants: {
    linear: variant({ angle: num('Angle', { enableIf: locked }) }),
    radial: variant({ angle: num('Angle'), radius: num('Radius', { enableIf: locked }) }),
  },
};
const lock = { kind: 'boolean', name: 'Lock', description: '', default: false } as PrefLeaf;
const schema: PrefGroup = { name: '', children: { lock, fill } };
const judge = (values: unknown) => prefJudge(schema, prefReader(schema, values));

describe('a field two variants of a union both hold', () => {
  it('takes its status from the variant the value holds', () => {
    const radial = { lock: true, fill: { type: 'radial', angle: 0 } };
    expect([...applyPrefConditions(schema, judge(radial)).disabled].sort()).toEqual(['fill.radius']);
    expect(prefStatusAt(schema, 'fill.angle', judge(radial)).enabled).toBe(true);
    const linear = { lock: true, fill: { type: 'linear', angle: 0 } };
    expect([...applyPrefConditions(schema, judge(linear)).disabled]).toEqual(['fill.angle']);
    expect(prefStatusAt(schema, 'fill.angle', judge(linear)).enabled).toBe(false);
    expect([...applyPrefConditions(schema, judge({ lock: true })).disabled]).toEqual(['fill.angle']);
  });

  it('takes it from every variant where the judge names none', () => {
    const none = () => false;
    expect([...applyPrefConditions(schema, (c, f) => ('path' in c && c.path === 'fill.type' ? none() : judge({ lock: true })(c, f))).disabled].sort())
      .toEqual(['fill.angle', 'fill.radius']);
  });

  it('takes it from the variant an entry holds', () => {
    const item: PrefUnion = {
      ...fill,
      variants: {
        linear: variant({ angle: num('Angle', { enableIf: { from: 'item', path: 'spin', is: false } }) }),
        radial: variant({ angle: num('Angle') }),
      },
    };
    const entry = (value: unknown) => applyPrefEntryConditions(item, 'fills.0', prefJudge(schema, () => undefined, { item, value })).disabled;
    expect([...entry({ type: 'radial', angle: 0, spin: true })]).toEqual([]);
    expect([...entry({ type: 'linear', angle: 0, spin: true })]).toEqual(['fills.0.angle']);
  });
});

describe('a union in an entry that holds nothing', () => {
  it('answers for the variant the item holds unset, read by the entry’s path from the root', () => {
    const x = (extra: object) => ({ kind: 'number', name: 'X', description: '', default: 0, ...extra }) as PrefLeaf;
    const fill = {
      kind: 'union', name: 'Fill', description: '', tag: 'type', default: { type: 'b' },
      variants: { a: { name: 'A', children: { x: x({ enableIf: { path: 'never' } }) } }, b: { name: 'B', children: { x: x({}) } } },
    } as unknown as PrefLeaf;
    const schema: PrefGroup = { name: '', children: { fills: { kind: 'list', name: 'Fills', description: '', default: [], item: fill } as PrefLeaf } };
    const holds = prefJudge(schema, prefReader(schema, { fills: [null] }));
    expect(prefStatusAt(schema, 'fills.0.x', holds).enabled).toBe(true);
  });
});

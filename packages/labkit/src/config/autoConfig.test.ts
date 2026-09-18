import { describe, expect, it } from 'vitest';
import { auto } from './auto';
import { autoPathsOf, resolveAutoConfig } from './autoConfig';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';

const schema = f.schema({
  width: f.number(432),
  gap: f.number(12).auto((c) => (c.width as number) / 24),
  cols: f.number(3).initial(auto),
  grid: f.group({ size: f.number(8).auto(() => 99) }),
});
const resolved = resolveConfigSchema(schema);
const raw = { width: 432, gap: 12, cols: 3, grid: { size: 8 } };

describe('autoPathsOf', () => {
  it('lists the dotted paths a schema starts auto', () => {
    expect(autoPathsOf(resolved)).toEqual(['cols']);
  });

  it('reaches leaves nested under a group', () => {
    const nested = resolveConfigSchema(
      f.schema({ grid: f.group({ size: f.number(8).initial(auto) }) }),
    );
    expect(autoPathsOf(nested)).toEqual(['grid.size']);
  });
});

describe('resolveAutoConfig', () => {
  it('leaves a config with nothing auto exactly as it was', () => {
    expect(resolveAutoConfig(resolved, raw, new Set())).toEqual(raw);
  });

  it('replaces an auto path that has a resolver with the computed value', () => {
    const out = resolveAutoConfig(resolved, raw, new Set(['gap']));
    expect(out.gap).toBe(18);
    expect(out.width).toBe(432);
  });

  it('deletes an auto path that has no resolver', () => {
    const out = resolveAutoConfig(resolved, raw, new Set(['cols'])) as Record<string, unknown>;
    expect('cols' in out).toBe(false);
  });

  it('resolves a leaf nested under a group', () => {
    const out = resolveAutoConfig(resolved, raw, new Set(['grid.size'])) as {
      grid: { size: number };
    };
    expect(out.grid.size).toBe(99);
  });

  it('lets one resolver read another auto path, already resolved', () => {
    const chained = resolveConfigSchema(
      f.schema({
        a: f.number(1).auto(() => 10),
        b: f.number(2).auto((c) => (c.a as number) * 3),
      }),
    );
    const out = resolveAutoConfig(chained, { a: 1, b: 2 }, new Set(['a', 'b'])) as {
      a: number;
      b: number;
    };
    expect(out).toEqual({ a: 10, b: 30 });
  });

  it('resolves a dependency declared after its dependent', () => {
    const backward = resolveConfigSchema(
      f.schema({
        b: f.number(2).auto((c) => (c.a as number) * 3),
        a: f.number(1).auto(() => 10),
      }),
    );
    const out = resolveAutoConfig(backward, { a: 1, b: 2 }, new Set(['a', 'b'])) as {
      a: number;
      b: number;
    };
    expect(out).toEqual({ a: 10, b: 30 });
  });

  it('throws naming the path when resolvers cycle', () => {
    const cyclic = resolveConfigSchema(
      f.schema({
        a: f.number(1).auto((c) => (c.b as number) + 1),
        b: f.number(2).auto((c) => (c.a as number) + 1),
      }),
    );
    expect(() => resolveAutoConfig(cyclic, { a: 1, b: 2 }, new Set(['a', 'b']))).toThrow(/cycle/i);
    expect(() => resolveAutoConfig(cyclic, { a: 1, b: 2 }, new Set(['a', 'b']))).toThrow(/"a"/);
  });

  it('throws on a resolver that reads its own path', () => {
    const selfish = resolveConfigSchema(
      f.schema({ a: f.number(1).auto((c) => (c.a as number) + 1) }),
    );
    expect(() => resolveAutoConfig(selfish, { a: 1 }, new Set(['a']))).toThrow(/cycle/i);
  });

  it('ignores an auto path the schema does not have', () => {
    expect(resolveAutoConfig(resolved, raw, new Set(['gone']))).toEqual(raw);
  });

  it('does not mutate the config it was given', () => {
    const before = structuredClone(raw);
    resolveAutoConfig(resolved, raw, new Set(['gap', 'grid.size']));
    expect(raw).toEqual(before);
  });
});

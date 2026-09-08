import type { PrefGroup } from '@weasel-js/ui';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { titleCase } from './rules';
import type { ConfigRule } from './types';

const leafAt = (r: ReturnType<typeof resolveConfigSchema>, k: string) =>
  r.group.children[k] as unknown as Record<string, unknown>;

describe('titleCase', () => {
  it('splits camelCase without shattering acronyms', () => {
    expect(titleCase('cellSize')).toBe('Cell size');
    expect(titleCase('showGrid')).toBe('Show grid');
    expect(titleCase('useHDR')).toBe('Use hdr');
    expect(titleCase('seed')).toBe('Seed');
  });
});

describe('resolveConfigSchema', () => {
  it('titleCases a missing label', () => {
    const r = resolveConfigSchema(f.schema({ cellSize: f.number(20) }), []);
    expect(leafAt(r, 'cellSize').name).toBe('Cell size');
  });

  it('an explicit label beats the built-in rule', () => {
    const r = resolveConfigSchema(f.schema({ cellSize: f.number(20).label('Grid spacing') }), []);
    expect(leafAt(r, 'cellSize').name).toBe('Grid spacing');
  });

  it('carries the default through', () => {
    const r = resolveConfigSchema(f.schema({ cellSize: f.number(20) }), []);
    expect(leafAt(r, 'cellSize').default).toBe(20);
  });

  it('picks a slider when a number has both bounds', () => {
    const r = resolveConfigSchema(f.schema({ a: f.number(1).range(0, 10), b: f.number(1) }), []);
    expect(leafAt(r, 'a').control).toBe('slider');
    expect(leafAt(r, 'b').control).toBeUndefined();
  });

  it('an explicit .input() beats the slider rule', () => {
    const r = resolveConfigSchema(f.schema({ a: f.number(1).range(0, 10).input() }), []);
    expect(leafAt(r, 'a').control).toBe('input');
  });

  it('infers kind from typeof for an f.value leaf', () => {
    const r = resolveConfigSchema(
      f.schema({ on: f.value(true), n: f.value(2), s: f.value('x') }),
      [],
    );
    expect(leafAt(r, 'on').kind).toBe('boolean');
    expect(leafAt(r, 'n').kind).toBe('number');
    expect(leafAt(r, 's').kind).toBe('string');
  });

  it('a consumer rule claims an f.value kind before the built-in', () => {
    const colorByName: ConfigRule = (ctx) => (ctx.key.endsWith('Color') ? { kind: 'color' } : null);
    const r = resolveConfigSchema(f.schema({ tintColor: f.value('#fff') }), [colorByName]);
    expect(leafAt(r, 'tintColor').kind).toBe('color');
  });

  it('a consumer rule cannot overwrite a kind the factory settled', () => {
    const forceColor: ConfigRule = () => ({ kind: 'color' });
    const r = resolveConfigSchema(f.schema({ a: f.string('#fff') }), [forceColor]);
    expect(leafAt(r, 'a').kind).toBe('string');
  });

  it('a consumer rule cannot overwrite an explicit annotation', () => {
    const forceLabel: ConfigRule = () => ({ name: 'Forced' });
    const r = resolveConfigSchema(f.schema({ a: f.number(1).label('Mine') }), [forceLabel]);
    expect(leafAt(r, 'a').name).toBe('Mine');
  });

  it('an earlier consumer rule beats a later one', () => {
    const first: ConfigRule = () => ({ name: 'First' });
    const second: ConfigRule = () => ({ name: 'Second' });
    const r = resolveConfigSchema(f.schema({ a: f.number(1) }), [first, second]);
    expect(leafAt(r, 'a').name).toBe('First');
  });

  it('collects sections in first-appearance order', () => {
    const r = resolveConfigSchema(
      f.schema({
        b: f.number(1).section('Two'),
        a: f.number(1).section('One'),
        c: f.number(1).section('Two'),
      }),
      [],
    );
    expect(r.sections).toEqual([
      { at: '', label: 'Two', paths: ['b', 'c'] },
      { at: '', label: 'One', paths: ['a'] },
    ]);
  });

  it('takes `collapsed` from any one leaf under the heading', () => {
    const r = resolveConfigSchema(
      f.schema({
        a: f.number(1).section('Advanced'),
        b: f.number(1).section('Advanced', { collapsed: true }),
        c: f.number(1).section('Plain'),
      }),
      [],
    );
    expect(r.sections).toEqual([
      { at: '', label: 'Advanced', paths: ['a', 'b'], collapsed: true },
      { at: '', label: 'Plain', paths: ['c'] },
    ]);
  });

  it('collects showIf and node renderers by path', () => {
    const r = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        seed: f.value(0).showIf((c) => c.showGrid === true),
        custom: f.number(1).render(() => null),
      }),
      [],
    );
    expect(r.showIf.get('seed')?.({ showGrid: false })).toBe(false);
    expect(r.renderers.custom).toBeTypeOf('function');
    expect(r.renderers.seed).toBeUndefined();
  });

  it('every leaf gets a description, since PrefBase requires one', () => {
    const r = resolveConfigSchema(f.schema({ a: f.number(1) }), []);
    expect(leafAt(r, 'a').description).toBe('');
  });

  it('preserves declaration order', () => {
    const r = resolveConfigSchema(f.schema({ z: f.number(1), a: f.number(1) }), []);
    expect(Object.keys(r.group.children)).toEqual(['z', 'a']);
  });
});

describe('resolveConfigSchema / nested groups', () => {
  const nested = () =>
    resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        grid: f
          .group({
            size: f.number(20).range(5, 80),
            color: f.color('#ffffff').showIf((c) => c.showGrid === true),
          })
          .label('Grid'),
      }),
      [],
    );

  it('emits a nested PrefGroup, not a flattened child', () => {
    const r = nested();
    const grid = r.group.children.grid as PrefGroup;
    expect('children' in grid).toBe(true);
    expect(Object.keys(grid.children)).toEqual(['size', 'color']);
    expect(grid.name).toBe('Grid');
  });

  it('titleCases a group with no label', () => {
    const r = resolveConfigSchema(f.schema({ gridStyle: f.group({ a: f.number(1) }) }), []);
    expect((r.group.children.gridStyle as PrefGroup).name).toBe('Grid style');
  });

  it('runs the rule chain on a nested leaf, keyed by its own segment', () => {
    const r = nested();
    const grid = r.group.children.grid as PrefGroup;
    const size = grid.children.size as unknown as Record<string, unknown>;
    expect(size.name).toBe('Size');
    expect(size.control).toBe('slider');
  });

  it('gives a rule the full dotted path alongside the key', () => {
    const seen: { key: string; path: string }[] = [];
    const spy: ConfigRule = (ctx) => {
      seen.push({ key: ctx.key, path: ctx.path });
      return null;
    };
    resolveConfigSchema(f.schema({ grid: f.group({ size: f.number(1) }) }), [spy]);
    expect(seen).toContainEqual({ key: 'size', path: 'grid.size' });
  });

  it('keys showIf and renderers by the full dotted path', () => {
    const r = nested();
    expect(r.showIf.get('grid.color')?.({ showGrid: false })).toBe(false);
    expect(r.showIf.get('color')).toBeUndefined();
  });

  it('a section inside a group buckets the children of that group', () => {
    const r = resolveConfigSchema(
      f.schema({
        top: f.number(1).section('Outer'),
        grid: f.group({ size: f.number(1).section('Inner'), color: f.color('#fff') }),
      }),
      [],
    );
    expect(r.sections).toEqual([
      { at: '', label: 'Outer', paths: ['top'] },
      { at: 'grid', label: 'Inner', paths: ['grid.size'] },
    ]);
  });

  it('a group can itself sit under a section heading', () => {
    const r = resolveConfigSchema(
      f.schema({ grid: f.group({ size: f.number(1) }).section('Advanced') }),
      [],
    );
    expect(r.sections).toEqual([{ at: '', label: 'Advanced', paths: ['grid'] }]);
  });
});

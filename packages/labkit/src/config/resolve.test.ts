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
      { label: 'Two', paths: ['b', 'c'] },
      { label: 'One', paths: ['a'] },
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

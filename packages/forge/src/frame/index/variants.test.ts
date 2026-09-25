import { f } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import { mergeConfig, variantRows, withValueAt } from './variants';

describe('variantRows', () => {
  it('varies booleans and enums, in schema order, labeled as the controls panel labels them', () => {
    const schema = f.schema({
      label: f.string('Save'),
      disabled: f.boolean(false),
      variant: f.enum('primary', ['primary', 'ghost']),
      size: f.enum('md', [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
      ]).label('Button size'),
    });
    expect(variantRows(schema)).toEqual([
      { path: 'disabled', label: 'Disabled', values: [{ value: false, label: 'false' }, { value: true, label: 'true' }] },
      { path: 'variant', label: 'Variant', values: [{ value: 'primary', label: 'primary' }, { value: 'ghost', label: 'ghost' }] },
      { path: 'size', label: 'Button size', values: [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }] },
    ]);
  });

  it('reaches into groups with a dotted path', () => {
    const schema = f.schema({ grid: f.group({ snap: f.boolean(true) }) });
    expect(variantRows(schema).map((row) => row.path)).toEqual(['grid.snap']);
  });

  it('skips enums with too many choices, hidden controls, controls that draw themselves, and controls hidden at the defaults', () => {
    const schema = f.schema({
      many: f.enum('a', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']),
      secret: f.boolean(false).hidden(),
      drawn: f.boolean(false).render(() => null),
      mode: f.enum('simple', ['simple', 'advanced']),
      extra: f.boolean(false).showIf((config) => config.mode === 'advanced'),
    });
    expect(variantRows(schema).map((row) => row.path)).toEqual(['mode']);
  });

  it('stops at six rows', () => {
    const shape = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`flag${i}`, f.boolean(false)]));
    expect(variantRows(f.schema(shape))).toHaveLength(6);
  });
});

describe('mergeConfig', () => {
  it('merges nested objects and replaces everything else', () => {
    expect(mergeConfig({ a: 1, g: { x: 1, y: 2 }, list: [1] }, { g: { y: 3 }, list: [2] })).toEqual({
      a: 1,
      g: { x: 1, y: 3 },
      list: [2],
    });
  });

  it('keeps the base where there is nothing to merge', () => {
    expect(mergeConfig({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});

describe('withValueAt', () => {
  it('sets a dotted path without touching the original', () => {
    const config = { grid: { snap: false, size: 4 } };
    expect(withValueAt(config, 'grid.snap', true)).toEqual({ grid: { snap: true, size: 4 } });
    expect(config.grid.snap).toBe(false);
  });
});

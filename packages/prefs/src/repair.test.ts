import { describe, expect, it } from 'vitest';
import { repairPrefValue } from './repair';
import type { PrefLeaf } from './schema';

const num = (extra: object = {}): PrefLeaf =>
  ({ kind: 'number', name: 'N', description: '', default: 10, min: 0, max: 100, ...extra }) as PrefLeaf;
const en: PrefLeaf = {
  kind: 'enum',
  name: 'E',
  description: '',
  default: 'a',
  options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
} as PrefLeaf;

describe('repairPrefValue', () => {
  it('clamps a number into min..max', () => {
    expect(repairPrefValue(num(), 150)).toBe(100);
    expect(repairPrefValue(num(), -5)).toBe(0);
    expect(repairPrefValue(num(), 42)).toBe(42);
  });

  it('defaults a number that is not one', () => {
    expect(repairPrefValue(num(), '42')).toBe(10);
    expect(repairPrefValue(num(), Number.NaN)).toBe(10);
    expect(repairPrefValue(num(), null)).toBe(10);
  });

  it('keeps infinity only at an endless end', () => {
    expect(repairPrefValue(num({ endless: 'max' }), Infinity)).toBe(Infinity);
    expect(repairPrefValue(num({ endless: 'max' }), -Infinity)).toBe(0);
    expect(repairPrefValue(num(), Infinity)).toBe(100);
    expect(repairPrefValue(num({ max: undefined }), Infinity)).toBe(10);
  });

  it('reads the strings JSON turns infinity into as infinity, under the same endless rules', () => {
    expect(repairPrefValue(num({ endless: 'max' }), 'Infinity')).toBe(Infinity);
    expect(repairPrefValue(num({ endless: 'min' }), '-Infinity')).toBe(-Infinity);
    expect(repairPrefValue(num({ endless: 'max' }), '-Infinity')).toBe(0);
    expect(repairPrefValue(num(), 'Infinity')).toBe(100);
    expect(repairPrefValue(num(), '42')).toBe(10);
  });

  it('defaults an enum value no option has', () => {
    expect(repairPrefValue(en, 'b')).toBe('b');
    expect(repairPrefValue(en, 'gone')).toBe('a');
  });

  it('passes an encoded enum or boolean through, since its stored form is not the option', () => {
    const encoded = { ...en, encoding: { read: () => 'a', write: () => 'x' } } as PrefLeaf;
    expect(repairPrefValue(encoded, [4, 2])).toEqual([4, 2]);
    const flag = {
      kind: 'boolean', name: 'F', description: '', default: false,
      encoding: { read: () => true, write: () => 'italic' },
    } as PrefLeaf;
    expect(repairPrefValue(flag, 'italic')).toBe('italic');
  });

  it('defaults a boolean, string or color of the wrong type', () => {
    const b = { kind: 'boolean', name: 'B', description: '', default: true } as PrefLeaf;
    const s = { kind: 'string', name: 'S', description: '', default: 'x' } as PrefLeaf;
    const c = { kind: 'color', name: 'C', description: '', default: '#000' } as PrefLeaf;
    expect(repairPrefValue(b, 'yes')).toBe(true);
    expect(repairPrefValue(s, 4)).toBe('x');
    expect(repairPrefValue(c, '#fff')).toBe('#fff');
    expect(repairPrefValue(c, 0xffffff)).toBe('#000');
  });

  it('defaults an object leaf that is not a plain object, unless it lifts scalars', () => {
    const obj = { kind: 'object', name: 'O', description: '', default: { x: 1 }, children: {} } as PrefLeaf;
    const lifting = { ...obj, fromScalar: (v: unknown) => ({ x: v }) } as PrefLeaf;
    const stored = { x: 5 };
    expect(repairPrefValue(obj, stored)).toBe(stored);
    expect(repairPrefValue(obj, 5)).toEqual({ x: 1 });
    expect(repairPrefValue(obj, [1])).toEqual({ x: 1 });
    expect(repairPrefValue(obj, null)).toEqual({ x: 1 });
    expect(repairPrefValue(lifting, 5)).toBe(5);
  });

  it('passes kinds it has no rule for through unchanged', () => {
    const custom = { kind: 'registry-enum', name: 'R', description: '', default: 'select' } as PrefLeaf;
    const stored = { anything: true };
    expect(repairPrefValue(custom, stored)).toBe(stored);
  });

  it('lets a validator decide, with undefined and a throw both meaning the default', () => {
    const custom = { kind: 'registry-enum', name: 'R', description: '', default: 'select' } as PrefLeaf;
    const validators = {
      'registry-enum': (stored: unknown) => (stored === 'pen' ? 'pen' : undefined),
    };
    expect(repairPrefValue(custom, 'pen', validators)).toBe('pen');
    expect(repairPrefValue(custom, 'gone', validators)).toBe('select');
    const throwing = { 'registry-enum': () => { throw new Error('no'); } };
    expect(repairPrefValue(custom, 'pen', throwing)).toBe('select');
  });

  it('lets a validator override a built-in kind', () => {
    expect(repairPrefValue(num(), 150, { number: (v) => v })).toBe(150);
  });

  it('decodes a stored infinity before a number validator sees it', () => {
    const seen: unknown[] = [];
    repairPrefValue(num(), 'Infinity', { number: (v) => (seen.push(v), v) });
    expect(seen).toEqual([Infinity]);
  });
});

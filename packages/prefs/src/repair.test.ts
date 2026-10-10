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

  describe('list', () => {
    const list = (extra: object = {}): PrefLeaf =>
      ({ kind: 'list', name: 'L', description: '', default: [1, 2, 3], item: num(), ...extra }) as PrefLeaf;

    it('defaults a stored value that is not an array', () => {
      expect(repairPrefValue(list(), 'nope')).toEqual([1, 2, 3]);
      expect(repairPrefValue(list(), { 0: 1 })).toEqual([1, 2, 3]);
    });

    it('reads each entry as its item leaf would, so one bad entry costs only itself', () => {
      expect(repairPrefValue(list(), [5, 500, 'x'])).toEqual([5, 100, 10]);
    });

    it('returns the stored array itself when every entry is already valid', () => {
      const stored = [4, 5];
      expect(repairPrefValue(list(), stored)).toBe(stored);
    });

    it('defaults a list shorter than minItems and cuts one longer than maxItems', () => {
      expect(repairPrefValue(list({ minItems: 3 }), [7, 8])).toEqual([1, 2, 3]);
      expect(repairPrefValue(list({ maxItems: 2 }), [7, 8, 9])).toEqual([7, 8]);
    });

    it('nests: a list of lists repairs the inner entries', () => {
      const outer = { kind: 'list', name: 'O', description: '', default: [], item: list() } as PrefLeaf;
      expect(repairPrefValue(outer, [[1, 'x'], 'nope'])).toEqual([[1, 10], [1, 2, 3]]);
    });

    it('hands an entry of an app-defined kind to that kind\'s validator', () => {
      const tags = { kind: 'list', name: 'T', description: '', default: [], item: { kind: 'tag', name: 'Tag', description: '', default: 'none' } } as PrefLeaf;
      const validators = { tag: (v: unknown) => (typeof v === 'string' && v.startsWith('#') ? v : undefined) };
      expect(repairPrefValue(tags, ['#a', 'b'], validators)).toEqual(['#a', 'none']);
    });
  });

  describe('object fields', () => {
    const box = {
      kind: 'object', name: 'Box', description: '', default: { w: 1 },
      children: {
        w: num(),
        look: { name: 'Look', members: { style: en } },
      },
    } as unknown as PrefLeaf;

    it('reads each field it holds as that field\'s leaf would, sections included', () => {
      expect(repairPrefValue(box, { w: 500, style: 'zzz' })).toEqual({ w: 100, style: 'a' });
    });

    it('leaves an omitted field omitted and an undescribed one alone', () => {
      expect(repairPrefValue(box, { extra: 'kept' })).toEqual({ extra: 'kept' });
    });

    it('returns the stored object itself when every field is already valid', () => {
      const stored = { w: 5, style: 'b' };
      expect(repairPrefValue(box, stored)).toBe(stored);
    });

    it('checks each entry of a list of objects', () => {
      const boxes = { kind: 'list', name: 'Boxes', description: '', default: [], item: box } as PrefLeaf;
      expect(repairPrefValue(boxes, [{ w: -5 }, 7])).toEqual([{ w: 0 }, { w: 1 }]);
    });
  });

  describe('map', () => {
    const map = { kind: 'map', name: 'M', description: '', default: { a: 1 }, item: num() } as PrefLeaf;

    it('defaults a stored value that is not a plain object', () => {
      expect(repairPrefValue(map, [1])).toEqual({ a: 1 });
      expect(repairPrefValue(map, 'nope')).toEqual({ a: 1 });
    });

    it('reads each value as its item leaf would, under its own key', () => {
      expect(repairPrefValue(map, { x: 5, y: 500, z: 'bad' })).toEqual({ x: 5, y: 100, z: 10 });
    });

    it('returns the stored object itself when every value is already valid', () => {
      const stored = { x: 5 };
      expect(repairPrefValue(map, stored)).toBe(stored);
    });
  });

  describe('union', () => {
    const shape = {
      kind: 'union', name: 'Shape', description: '', tag: 'type', default: { type: 'circle', r: 10 },
      variants: {
        circle: { kind: 'object', name: 'Circle', description: '', default: { r: 10 }, children: { r: num() } },
        box: { kind: 'object', name: 'Box', description: '', default: { w: 10 }, children: { w: num() } },
      },
    } as unknown as PrefLeaf;

    it('defaults a value whose tag names no variant', () => {
      expect(repairPrefValue(shape, { type: 'star', r: 3 })).toEqual({ type: 'circle', r: 10 });
      expect(repairPrefValue(shape, { r: 3 })).toEqual({ type: 'circle', r: 10 });
      expect(repairPrefValue(shape, 'circle')).toEqual({ type: 'circle', r: 10 });
    });

    it('reads the fields as the tagged variant\'s leaves would, keeping the tag', () => {
      expect(repairPrefValue(shape, { type: 'box', w: 900 })).toEqual({ type: 'box', w: 100 });
    });
  });
});

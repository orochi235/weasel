import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { fieldSweep } from './fieldSweep';

const walk = <V>(s: { walk(): Iterable<V> }): V[] => [...s.walk()];

describe('fieldSweep', () => {
  it('walks a number over its range by its step, labeled with its suffix', () => {
    const s = fieldSweep(f.number(4).range(0, 8).step(2).suffix('px'));
    expect(walk(s)).toEqual([0, 2, 4, 6, 8]);
    expect(s.label(6)).toBe('6 px');
  });

  it('walks a number’s stops where it has them', () => {
    expect(walk(fieldSweep(f.number(1).range(0, 100).stops([1, 10, 100])))).toEqual([1, 10, 100]);
  });

  it('takes a step or count for a number that declares neither', () => {
    const node = f.number(0).range(0, 1);
    expect(walk(fieldSweep(node, { count: 3 }))).toEqual([0, 0.5, 1]);
    expect(() => fieldSweep(node)).toThrow(RangeError);
    expect(() => fieldSweep(f.number(0).step(1))).toThrow(RangeError);
  });

  it('walks an enum’s options under their labels, and a boolean off then on', () => {
    const e = fieldSweep(
      f.enum('a', [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ]),
    );
    expect(walk(e)).toEqual(['a', 'b']);
    expect(e.label('b')).toBe('Beta');
    expect(walk(fieldSweep(f.boolean(true)))).toEqual([false, true]);
  });

  it('refuses a kind with no values to walk', () => {
    expect(() => fieldSweep(f.string('x'))).toThrow(TypeError);
  });
});

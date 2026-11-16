import { describe, expect, it } from 'vitest';
import { prefObjectField, prefObjectWithField } from './object';
import type { PrefObject } from './schema';

const stroke: PrefObject = {
  kind: 'object', name: 'Stroke', description: '', default: { paint: '#000', width: 1 },
  children: {
    paint: { kind: 'color', name: 'Paint', description: '', default: '#000' },
    width: { kind: 'number', name: 'Width', description: '', default: 1 },
  },
};

describe('prefObjectWithField', () => {
  it('sets one field of the object held, leaving the object it was given alone', () => {
    const held = { paint: '#f00', width: 2 };
    expect(prefObjectWithField(stroke, held, 'width', 3)).toEqual({ paint: '#f00', width: 3 });
    expect(held.width).toBe(2);
  });

  it('starts from the leaf\'s default where nothing is held, so the object is whole', () => {
    expect(prefObjectWithField(stroke, undefined, 'width', 2)).toEqual({ paint: '#000', width: 2 });
    expect(stroke.default).toEqual({ paint: '#000', width: 1 });
  });

  it('lifts a scalar through `fromScalar` where the leaf has one, and starts from the default where it has none', () => {
    const lifted: PrefObject = { ...stroke, fromScalar: (v) => ({ paint: v, width: 5 }) };
    expect(prefObjectWithField(lifted, '#0f0', 'width', 2)).toEqual({ paint: '#0f0', width: 2 });
    expect(prefObjectWithField(stroke, '#0f0', 'width', 2)).toEqual({ paint: '#000', width: 2 });
  });

  it('starts from nothing where the default is no object', () => {
    expect(prefObjectWithField({ ...stroke, default: undefined }, undefined, 'width', 2)).toEqual({ width: 2 });
  });

  it('drops a field set to undefined, and holds no key for it', () => {
    const next = prefObjectWithField(stroke, { paint: '#f00', width: 2 }, 'width', undefined);
    expect(next).toEqual({ paint: '#f00' });
    expect('width' in next).toBe(false);
  });
});

describe('a dotted field of an object leaf', () => {
  it('reads and sets a field of a field, making the object on the way', () => {
    const held = { width: 2, nib: { angle: 1, ratio: 0.5 } };
    expect(prefObjectField(held, 'nib.angle')).toBe(1);
    expect(prefObjectField(held, 'trim.end')).toBeUndefined();
    expect(prefObjectWithField(stroke, held, 'nib.angle', 2)).toEqual({ width: 2, nib: { angle: 2, ratio: 0.5 } });
    expect(prefObjectWithField(stroke, held, 'trim.end', 0.4)).toEqual({ ...held, trim: { end: 0.4 } });
    expect(held.nib.angle).toBe(1);
  });

  it('drops an object a cleared field leaves empty', () => {
    expect(prefObjectWithField(stroke, { width: 2, trim: { end: 0.4 } }, 'trim.end', undefined)).toEqual({ width: 2 });
    expect(prefObjectWithField(stroke, { width: 2, trim: { start: 0.1, end: 0.4 } }, 'trim.end', undefined))
      .toEqual({ width: 2, trim: { start: 0.1 } });
  });
});


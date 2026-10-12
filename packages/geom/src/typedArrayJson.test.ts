import { describe, expect, it } from 'vitest';
import { PATH_L, PATH_M } from './commands';
import type { PolygonPath } from './path';
import { reviveTypedArrays, tagTypedArrays, typedArrayReplacer, untagTypedArray } from './typedArrayJson';

const path: PolygonPath = {
  kind: 'polygon',
  commands: Uint8Array.of(PATH_M, PATH_L),
  coords: Float32Array.of(0, 0.5, 10, 20),
  fillRule: 'nonzero',
};

describe('tagTypedArrays', () => {
  it('writes each typed array as a tag and its numbers, at any depth', () => {
    expect(tagTypedArrays({ shapes: [path], n: 1 })).toEqual({
      shapes: [{
        kind: 'polygon',
        commands: { __ta: 'u8', data: [PATH_M, PATH_L] },
        coords: { __ta: 'f32', data: [0, 0.5, 10, 20] },
        fillRule: 'nonzero',
      }],
      n: 1,
    });
  });

  it('leaves what it was given as it was', () => {
    const value = { path };
    tagTypedArrays(value);
    expect(value.path.coords).toBeInstanceOf(Float32Array);
  });

  it('passes on what is neither a typed array nor a plain container', () => {
    const when = new Date(0);
    expect(tagTypedArrays({ when, text: 'a', none: null })).toEqual({ when, text: 'a', none: null });
  });
});

describe('reviveTypedArrays', () => {
  it('reads a path back from JSON, each array of the type it was', () => {
    const back = reviveTypedArrays(JSON.parse(JSON.stringify(tagTypedArrays({ path })))) as { path: PolygonPath };
    expect(back.path.commands).toBeInstanceOf(Uint8Array);
    expect(back.path.coords).toBeInstanceOf(Float32Array);
    expect(back).toEqual({ path });
  });

  it('round-trips every kind of number array', () => {
    const all = [
      Int8Array.of(-1), Uint8Array.of(1), Uint8ClampedArray.of(255), Int16Array.of(-300), Uint16Array.of(300),
      Int32Array.of(-70000), Uint32Array.of(70000), Float32Array.of(0.5), Float64Array.of(0.1),
    ];
    const back = reviveTypedArrays(JSON.parse(JSON.stringify(tagTypedArrays(all)))) as unknown[];
    expect(back).toEqual(all);
    back.forEach((a, i) => expect(Object.prototype.toString.call(a)).toBe(Object.prototype.toString.call(all[i])));
  });

  it('leaves an object that only looks tagged alone', () => {
    expect(reviveTypedArrays({ __ta: 'nope', data: [1] })).toEqual({ __ta: 'nope', data: [1] });
    expect(untagTypedArray({ __ta: 'f32' })).toBeUndefined();
  });
});

describe('typedArrayReplacer', () => {
  it('tags as `JSON.stringify` walks', () => {
    expect(JSON.parse(JSON.stringify({ path }, typedArrayReplacer))).toEqual(tagTypedArrays({ path }));
  });
});

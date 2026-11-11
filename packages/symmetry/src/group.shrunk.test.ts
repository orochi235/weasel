import { describe, expect, it } from 'vitest';
import { DEFAULT_SYMMETRY, symmetryTransforms } from './kinds';
import { specOfData } from './group';

const c = { x: 0, y: 0 };
const fromFile = (text: string) => specOfData(JSON.parse(text));

describe("a group's data, shrunk", () => {
  it('reads a kind named for an Object.prototype member as the default, where drawing it threw a TypeError', () => {
    expect(fromFile('{"symmetry":{"kind":"toString"}}').kind).toBe(DEFAULT_SYMMETRY.kind);
    expect(fromFile('{"symmetry":{"kind":"__proto__"}}').kind).toBe(DEFAULT_SYMMETRY.kind);
    expect(() => symmetryTransforms(fromFile('{"symmetry":{"kind":"toString"}}'), c)).not.toThrow();
  });

  it("reads a cell that is not a wallpaper cell as none, where `wallpaper` recursed until the stack ran out", () => {
    for (const cell of ['wallpaper', 'repeat', 'toString', null]) {
      const s = specOfData({ symmetry: { kind: 'wallpaper', cell } });
      expect(s.cell).toBe('none');
      expect(() => symmetryTransforms(s, c)).not.toThrow();
    }
  });

  it('reads an extent of null as the default box, where the lattice threw on it', () => {
    expect(specOfData({ symmetry: { kind: 'wallpaper', extent: null } }).extent).toEqual(DEFAULT_SYMMETRY.extent);
  });

  it('reads a field of the wrong type as its default', () => {
    const s = specOfData({ symmetry: { count: '6', glide: 1, spacing: null, glideRows: 'yes' } });
    expect(s).toEqual(DEFAULT_SYMMETRY);
  });
});

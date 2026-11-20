import { describe, expect, it } from 'vitest';
import { reviveTypedArrays, tagTypedArrays, typedArrayReplacer } from './typedArrayJson';

class Raw {
  __raw = 5;
}
class Tagged {
  __ta = 'f32';
  data = [1, 2];
}
class TaggedRaw {
  __raw = 5;
  get [Symbol.toStringTag]() {
    return 'TaggedRaw';
  }
}
class Holder {
  path = new Float32Array([1.5, 2]);
}

const viaCopy = (v: unknown) => reviveTypedArrays(JSON.parse(JSON.stringify(tagTypedArrays(v))));
const viaReplacer = (v: unknown) => reviveTypedArrays(JSON.parse(JSON.stringify(v, typedArrayReplacer)));

describe('tagTypedArrays on class instances', () => {
  it('wraps an instance shaped like a wrapper, as the replacer does', () => {
    expect(viaCopy({ t: new Raw() })).toEqual({ t: { __raw: 5 } });
    expect(viaReplacer({ t: new Raw() })).toEqual({ t: { __raw: 5 } });
  });

  it('wraps an instance with a string tag of its own shaped like a wrapper', () => {
    expect(viaCopy({ t: new TaggedRaw() })).toEqual({ t: { __raw: 5 } });
    expect(viaReplacer({ t: new TaggedRaw() })).toEqual({ t: { __raw: 5 } });
  });

  it('wraps an instance shaped like a tagged array, as the replacer does', () => {
    const out = viaCopy({ t: new Tagged() }) as { t: unknown };
    expect(out.t).not.toBeInstanceOf(Float32Array);
    expect(out.t).toEqual({ __ta: 'f32', data: [1, 2] });
    expect(viaReplacer({ t: new Tagged() })).toEqual(out);
  });

  it('tags a typed array held by an instance', () => {
    const out = viaCopy({ h: new Holder() }) as { h: { path: unknown } };
    expect(out.h.path).toBeInstanceOf(Float32Array);
    expect(viaReplacer({ h: new Holder() })).toEqual(out);
  });

  it("writes what an object's toJSON answers", () => {
    const d = new Date(0);
    expect(tagTypedArrays({ d })).toEqual({ d: d.toJSON() });
    expect(tagTypedArrays({ v: { toJSON: () => new Float32Array([3]) } })).toEqual({ v: { __ta: 'f32', data: [3] } });
  });
});

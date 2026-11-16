import { describe, expect, it } from 'vitest';
import { isUniformType } from './uniformTypes';

describe('isUniformType', () => {
  it('knows the uniform types, and not a type named like an Object.prototype member', () => {
    expect(isUniformType('vec4')).toBe(true);
    expect(isUniformType('sampler2D')).toBe(false);
    for (const name of ['constructor', 'toString', '__proto__', 'valueOf']) expect(isUniformType(name)).toBe(false);
  });
});

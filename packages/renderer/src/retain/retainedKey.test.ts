import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { ShaderProgramHandle } from '../shaders/registerProgram';
import { keepKey, sameKey, type RetainedKey } from './retainedKey';

describe('keepKey', () => {
  it('keeps an effect uniform array that its owner rewrites in place, so the next key differs', () => {
    const tint = new Float32Array([0, 0, 0, 1]);
    const program = { id: 'tint' } as ShaderProgramHandle;
    const children: RetainedKey['children'] = [];
    const key = (): RetainedKey => ({
      children, transform: mat3.identity(), alpha: 1, colorMatrix: new Float32Array(20), viewMatrix: undefined, clips: [],
      effects: [{ program, reach: 4, uniforms: { u_tint: tint } }],
    });
    const kept = keepKey(key());
    expect(sameKey(kept, key())).toBe(true);
    tint[0] = 0.5;
    expect(sameKey(kept, key())).toBe(false);
  });
});

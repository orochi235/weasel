import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerProgram,
  programSourceRegistry,
  getProgramSource,
  _resetProgramRegistryForTests,
} from './registerProgram';

const MINIMAL_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0, 0.5, 1.0, 1.0); }
`;

describe('registerProgram', () => {
  beforeEach(() => _resetProgramRegistryForTests());

  it('returns a handle with the given id', () => {
    const h = registerProgram('test-prog', { glsl: { frag: MINIMAL_FRAG } });
    expect(h.id).toBe('test-prog');
  });

  it('stores sources retrievable via getProgramSource', () => {
    registerProgram('prog-a', { glsl: { vert: 'vertex-src', frag: MINIMAL_FRAG } });
    const src = getProgramSource('prog-a');
    expect(src?.glsl?.vert).toBe('vertex-src');
    expect(src?.glsl?.frag).toBe(MINIMAL_FRAG);
  });

  it('getProgramSource returns null for unknown id', () => {
    expect(getProgramSource('not-registered')).toBeNull();
  });

  it('throws on duplicate id in prod mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      registerProgram('dup-test', { glsl: { frag: MINIMAL_FRAG } });
      expect(() => registerProgram('dup-test', { glsl: { frag: MINIMAL_FRAG } })).toThrow(/duplicate/i);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('replaces source on duplicate id in dev mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      registerProgram('hot-prog', { glsl: { frag: MINIMAL_FRAG } });
      const frag2 = MINIMAL_FRAG.replace('0.5', '0.8');
      registerProgram('hot-prog', { glsl: { frag: frag2 } });
      expect(getProgramSource('hot-prog')?.glsl?.frag).toContain('0.8');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('reflects each id once, the latest source replacing the earlier with no conflict', () => {
    const listener = vi.fn();
    const off = programSourceRegistry.subscribe(listener);
    registerProgram('refl', { glsl: { vert: 'v1', frag: MINIMAL_FRAG } });
    registerProgram('refl', { glsl: { vert: 'v2', frag: MINIMAL_FRAG } });
    const entries = programSourceRegistry.entries().filter((e) => e.key === 'refl');
    expect(entries.map((e) => [e.value.glsl?.vert, e.shadowed.length])).toEqual([['v2', 0]]);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });});

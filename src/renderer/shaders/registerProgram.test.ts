import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerProgram,
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
    const h = registerProgram('test-prog', '', MINIMAL_FRAG);
    expect(h.id).toBe('test-prog');
  });

  it('stores sources retrievable via getProgramSource', () => {
    registerProgram('prog-a', 'vertex-src', MINIMAL_FRAG);
    const src = getProgramSource('prog-a');
    expect(src?.vert).toBe('vertex-src');
    expect(src?.frag).toBe(MINIMAL_FRAG);
  });

  it('getProgramSource returns null for unknown id', () => {
    expect(getProgramSource('not-registered')).toBeNull();
  });

  it('throws on duplicate id in prod mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      registerProgram('dup-test', '', MINIMAL_FRAG);
      expect(() => registerProgram('dup-test', '', MINIMAL_FRAG)).toThrow(/duplicate/i);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('replaces source on duplicate id in dev mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      registerProgram('hot-prog', '', MINIMAL_FRAG);
      const frag2 = MINIMAL_FRAG.replace('0.5', '0.8');
      registerProgram('hot-prog', '', frag2);
      expect(getProgramSource('hot-prog')?.frag).toContain('0.8');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('handle id matches the registered id', () => {
    const h = registerProgram('match-id', '', MINIMAL_FRAG);
    expect(getProgramSource(h.id)).not.toBeNull();
  });
});

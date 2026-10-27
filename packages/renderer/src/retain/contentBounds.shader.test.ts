/** A retained group holding a custom shader is bounded by the shader's `bounds` when nothing can draw past them. */
import { afterEach, describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { ShaderDrawCommand } from '../DrawCommand';
import { _resetProgramRegistryForTests, registerProgram } from '../shaders/registerProgram';
import { contentBounds } from './contentBounds';

const W = 1000, H = 800;
const FILL = 'out vec4 o; void main() { o = vec4(1.0); }';

afterEach(() => _resetProgramRegistryForTests());

function shader(id: string, vert: string, frag: string): ShaderDrawCommand {
  return { kind: 'shader', program: registerProgram(id, vert, frag), uniforms: {}, bounds: { x: 100, y: 50, w: 40, h: 20 } };
}

const bound = (cmd: ShaderDrawCommand) => contentBounds([cmd], mat3.translated(mat3.identity(), 300, 300), [], 2, W, H);

describe('contentBounds for a custom shader', () => {
  it('covers its bounds rect in device pixels, whatever the transform', () => {
    const r = bound(shader('plain', '', FILL));
    expect(r.x).toBeLessThanOrEqual(200);
    expect(r.y).toBeLessThanOrEqual(100);
    expect(r.x + r.width).toBeGreaterThanOrEqual(280);
    expect(r.y + r.height).toBeGreaterThanOrEqual(140);
    expect(r.width).toBeLessThan(100);
  });

  it('takes the whole buffer for a program with its own vertex shader', () => {
    expect(bound(shader('own-vert', 'void main() {}', FILL))).toEqual({ x: 0, y: 0, width: W, height: H });
  });

  it('takes the whole buffer for a program reading gl_FragCoord without u_fragOrigin', () => {
    const frag = 'out vec4 o; void main() { o = vec4(gl_FragCoord.x); }';
    expect(bound(shader('frag-coord', '', frag))).toEqual({ x: 0, y: 0, width: W, height: H });
  });

  it('bounds a program reading gl_FragCoord through u_fragOrigin', () => {
    const frag = 'uniform vec2 u_fragOrigin; out vec4 o; void main() { o = vec4(gl_FragCoord.x - u_fragOrigin.x); }';
    expect(bound(shader('frag-origin', '', frag)).width).toBeLessThan(100);
  });

  it('takes the whole buffer for a program nobody registered', () => {
    const cmd: ShaderDrawCommand = { kind: 'shader', program: { id: 'missing' }, uniforms: {}, bounds: { x: 0, y: 0, w: 1, h: 1 } };
    expect(bound(cmd)).toEqual({ x: 0, y: 0, width: W, height: H });
  });
});

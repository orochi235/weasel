import { describe, expect, it } from 'vitest';
import { resolveInto, type Scratch, type SurfaceTexture } from './surfaceGl';

const READ = 0x8CA8;
const DRAW = 0x8CA9;
const FRAMEBUFFER = 0x8D40;
const READ_BINDING = 0x8CAA;
const DRAW_BINDING = 0x8CA6;
const SCISSOR_TEST = 0x0C11;

/** Just enough GL to track framebuffer bindings and the scissor test. */
function bindingGl() {
  const bound = { read: null as unknown, draw: null as unknown };
  let scissor = false;
  const gl = {
    READ_FRAMEBUFFER: READ, DRAW_FRAMEBUFFER: DRAW, FRAMEBUFFER,
    READ_FRAMEBUFFER_BINDING: READ_BINDING, DRAW_FRAMEBUFFER_BINDING: DRAW_BINDING,
    SCISSOR_TEST, COLOR_BUFFER_BIT: 0x4000, NEAREST: 0x2600,
    blits: [] as { read: unknown; draw: unknown }[],
    bindFramebuffer(target: number, fbo: unknown) {
      if (target === READ || target === FRAMEBUFFER) bound.read = fbo;
      if (target === DRAW || target === FRAMEBUFFER) bound.draw = fbo;
    },
    getParameter(name: number) {
      if (name === READ_BINDING) return bound.read;
      if (name === DRAW_BINDING) return bound.draw;
      return null;
    },
    isEnabled: () => scissor,
    enable: () => { scissor = true; },
    disable: () => { scissor = false; },
    blitFramebuffer() { gl.blits.push({ ...bound }); },
  };
  return { gl, bound, scissorOn: () => scissor };
}

describe('resolveInto', () => {
  const scratch = { fbo: { id: 'scratch' } } as unknown as Scratch;
  const target = { fbo: { id: 'surface' } } as unknown as SurfaceTexture;

  it("blits the scratch into the surface and leaves the caller's framebuffer bound", () => {
    const { gl, bound, scissorOn } = bindingGl();
    const effects = { id: 'effects buffer' };
    gl.bindFramebuffer(FRAMEBUFFER, effects);
    gl.enable();
    resolveInto(gl as unknown as WebGL2RenderingContext, scratch, target, 8, 8);
    expect(gl.blits).toEqual([{ read: scratch.fbo, draw: target.fbo }]);
    expect(bound).toEqual({ read: effects, draw: effects });
    expect(scissorOn()).toBe(true);
  });

  it('restores separate read and draw bindings', () => {
    const { gl, bound } = bindingGl();
    const a = { id: 'a' }, b = { id: 'b' };
    gl.bindFramebuffer(READ, a);
    gl.bindFramebuffer(DRAW, b);
    resolveInto(gl as unknown as WebGL2RenderingContext, scratch, target, 8, 8);
    expect(bound).toEqual({ read: a, draw: b });
  });
});

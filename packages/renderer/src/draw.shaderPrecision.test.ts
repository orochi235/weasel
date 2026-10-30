import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { viewToMat3 } from '@weasel-js/geom';
import { makeGLRecorder, type GLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { registerProgram, _resetProgramRegistryForTests } from './shaders/registerProgram';
import type { DrawCommand } from './DrawCommand';

/**
 * A shader command far from the origin and zoomed in. The kit's vertex stage
 * finds each fragment's world point from its screen position, in float32, and
 * at world x = 262,144 a float32 holds a thirty-second of a unit: 2 px at 64x.
 * Nothing here runs a shader, so each test replays the stage's float32
 * arithmetic over what the renderer uploaded.
 */
const WORLD_X = 262_144;
const ZOOM = 64;
const STEP_PX = 0.25;
const PANS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const SX = 32.5;
const SY = 16.5;

const f = Math.fround;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_worldLocal;
out vec4 outColor;
void main() { outColor = vec4(fract(v_worldLocal), 0.0, 1.0); }
`;

let rec: GLRecorder;
beforeEach(() => _resetProgramRegistryForTests());
afterEach(() => _resetProgramRegistryForTests());

function frame(px: number, worldX = WORLD_X) {
  rec = makeGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
  const program = registerProgram('far-shader', '', FRAG);
  const view = viewToMat3({ x: worldX - px / ZOOM, y: 0, scale: { x: ZOOM, y: ZOOM } });
  rec.reset();
  r.render([{
    kind: 'group', transform: view,
    children: [{ kind: 'shader', program, uniforms: {}, bounds: { x: 0, y: 0, w: 64, h: 32 } } as DrawCommand],
  }], view);
}

/** The last upload to the uniform named `name`. */
function sent(name: string, fn: string): readonly unknown[] {
  const loc = [...rec.calls].reverse().find((c) => c.name === 'getUniformLocation' && c.args[1] === name)?.result;
  expect(loc, `nobody asked for ${name}`).toBeDefined();
  return rec.calls.filter((c) => c.name === fn && c.args[0] === loc).at(-1)!.args;
}

/** `(u_screenToLocal * vec3(screen, 1.0)).xy`, then `u_worldOrigin +` that. */
function stage(sx: number, sy: number) {
  const m = Float32Array.from(sent('u_screenToLocal', 'uniformMatrix3fv')[2] as Float32Array);
  const [, ox, oy] = sent('u_worldOrigin', 'uniform2f') as number[];
  const local: [number, number] = [
    f(f(f(m[0]! * sx) + f(m[3]! * sy)) + m[6]!),
    f(f(f(m[1]! * sx) + f(m[4]! * sy)) + m[7]!),
  ];
  return { local, origin: [f(ox!), f(oy!)] as const, world: [f(f(ox!) + local[0]), f(f(oy!) + local[1])] as const };
}

describe('a shader command far from the origin (world x = 262,144 at 64x)', () => {
  it('moves v_worldLocal under a quarter-pixel pan by a quarter pixel', () => {
    for (const k of PANS) {
      frame(k * STEP_PX);
      const { local, origin } = stage(SX, SY);
      const world = WORLD_X + (SX - k * STEP_PX) / ZOOM;
      // The origin holds what a float32 can and the local point the rest.
      expect(origin[0] + local[0], `pan ${k}`).toBeCloseTo(world, 6);
      expect(local[1], `pan ${k}`).toBeCloseTo(SY / ZOOM, 6);
    }
  });

  it('sends a zero origin near the origin, where v_world is v_worldLocal', () => {
    frame(0, 100);
    const { local, origin, world } = stage(SX, SY);
    expect(origin).toEqual([0, 0]);
    expect(world).toEqual(local);
    expect(world[0]).toBeCloseTo(100 + SX / ZOOM, 5);
  });
});

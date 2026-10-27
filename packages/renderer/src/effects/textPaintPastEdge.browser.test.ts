/**
 * Text painted through a registered paint kind, inside a blurred group and
 * lying mostly past the top edge of the buffer: its paint is rendered into a
 * scratch texture first, and that texture has to cover the glyphs the
 * effects buffer draws past the edge, or the blur reaching in loses them.
 * The paint is green only past the edge, so nothing but that reach can put
 * green on the canvas; a texture cut at the edge samples its clear edge row.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerFont } from '@weasel-js/font';
import type { Paint } from '@weasel-js/paint';
import { WeaselRenderer } from '../WeaselRenderer';
import { registerPaintDrawKind } from '../paintKinds';
import { blur } from './builtins';
import type { Effect } from './types';
import type { DrawCommand } from '../DrawCommand';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';

const FAMILY = 'text-paint-past-edge-inter';
const W = 64;
const H = 24;

const SCREEN_VERT = `#version 300 es
in vec2 a_position;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec2 v_screen;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  v_screen = screen.xy;
  gl_Position = vec4((u_proj * vec3(screen.xy, 1.0)).xy, 0.0, 1.0);
}
`;

const GREEN_ABOVE_FRAG = `#version 300 es
precision highp float;
in vec2 v_screen;
out vec4 outColor;
void main() { outColor = v_screen.y < 0.0 ? vec4(0.0, 1.0, 0.0, 1.0) : vec4(0.0); }
`;

let unregister: (() => void) | undefined;
let renderer: WeaselRenderer | undefined;

beforeAll(async () => {
  await registerFont(FAMILY, { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
  unregister = registerPaintDrawKind({
    id: 'past-edge-green',
    programs: { 'past-edge-green': { vert: SCREEN_VERT, frag: GREEN_ABOVE_FRAG } },
    bind: (ctx) => {
      const program = ctx.program('past-edge-green');
      if (!program) return null;
      ctx.gl.useProgram(program.handle);
      ctx.setProjAndModel(program);
      return program;
    },
  });
});

afterAll(() => unregister?.());

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** A line of text whose glyphs end a pixel or two into the buffer. */
const text = (paint: Paint): DrawCommand => ({
  kind: 'text', x: 4, y: -18,
  runs: [{
    text: 'HHHH', fontFamily: FAMILY, fontSize: 20, fontWeight: 400, fontStyle: 'normal',
    fill: { paint }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  }],
  style: {},
});

/** Green summed over the buffer, `cmd` drawn inside a group carrying `effects`. */
function green(cmd: DrawCommand, effects: Effect[] | undefined): number {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer?.dispose();
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderer.render([{ kind: 'group', effects, children: [cmd] }]);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0;
  for (let i = 0; i < W * H; i++) sum += px[i * 4 + 1] / 255;
  return sum;
}

describe('texture-painted text past the edge, inside a blurred group', () => {
  const painted = text({ kind: 'past-edge-green' } as unknown as Paint);

  it('feeds the blur the paint of glyphs past the edge', () => {
    expect(green(painted, blur({ radius: 6 }))).toBeGreaterThan(5);
  });

  it('puts no green on the canvas drawn without the blur', () => {
    expect(green(painted, undefined)).toBe(0);
  });
});

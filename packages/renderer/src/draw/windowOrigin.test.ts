/**
 * The renderer hands an effect pass its window's origin. The pixels are
 * `effects/windowOrigin.browser.test.ts`; this pins the upload.
 */
import { describe, expect, it } from 'vitest';
import { makeGLRecorder } from '../testing/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import { registerEffect } from '../effects/types';
import type { DrawCommand } from '../DrawCommand';

const ORIGIN_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_windowOrigin;
out vec4 outColor;
void main() { outColor = vec4(u_windowOrigin / 255.0, 0.0, 1.0); }
`;

describe('u_windowOrigin', () => {
  it("is set to the top-left device pixel of the group's window", () => {
    const program = registerEffect('jsdom-fx-window-origin', { glsl: ORIGIN_FRAG });
    const rec = makeGLRecorder();
    const renderer = new WeaselRenderer({ gl: rec.gl, width: 128, height: 128, dpr: 1 });
    const square: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 10, y: 20, width: 10, height: 10 },
      fill: { paint: { color: '#ffffff' } },
    };
    renderer.render([{ kind: 'group', effects: [{ program, reach: 0 }], children: [square] }]);
    const locations = new Set(rec.calls.flatMap((c, i) =>
      c.name === 'getUniformLocation' && c.args[1] === 'u_windowOrigin' ? [i] : []));
    expect(locations.size).toBeGreaterThan(0);
    const uploads = rec.calls.filter((c) => c.name === 'uniform2f' && locations.has(c.args[0] as number));
    expect(uploads.map((c) => c.args.slice(1))).toEqual([[9, 19]]);
    renderer.dispose();
  });
});

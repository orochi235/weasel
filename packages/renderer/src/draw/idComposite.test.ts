import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '../DrawCommand';
import { blur } from '../effects/builtins';
import { createGLRecorder } from '../testing/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import { ID_COMPOSITE_WGSL } from '../gpu/webgpu/wgsl/idComposite';
import { ID_COMPOSITE_FRAG } from './idComposite';

/** Alpha lowered by half, everything else as it was. */
const FADE = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, -0.5];

describe('a group with effects under a color matrix, in an id frame', () => {
  it('claims ids at the alpha its color matrix maps to', () => {
    const rec = createGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    rec.reset();
    const rect: DrawCommand = {
      kind: 'path', path: { kind: 'rect', x: 10, y: 10, width: 20, height: 20 }, fill: { paint: { color: '#fff' } },
    };
    r.renderIds([{ kind: 'group', pickId: 7, effects: blur({ radius: 2 }), colorMatrix: FADE, children: [rect] }]);
    const asked = (name: string) => rec.calls.filter((c) => c.name === 'getUniformLocation' && c.args[1] === name);
    const idProgram = asked('u_groupId')[0]!.args[0];
    const bias = asked('u_colorBias').find((c) => c.args[0] === idProgram);
    expect(bias).toBeDefined();
    const writes = rec.calls.filter((c) => c.name === 'uniform4f' && c.args[0] === bias!.result);
    expect(writes.map((c) => c.args.slice(1))).toContainEqual([0, 0, 0, -0.5]);
  });
});

describe('the id composite pass', () => {
  it('claims by the mapped alpha clamped to 0–1, the alpha the color composite draws', () => {
    expect(ID_COMPOSITE_FRAG).toContain('clamp((u_colorMatrix * vec4(rgb, src.a) + u_colorBias).a, 0.0, 1.0) * u_alpha');
    expect(ID_COMPOSITE_WGSL).toContain('saturate((u.u_colorMatrix * vec4f(rgb, src.a) + u.u_colorBias).a) * u.u_alpha');
  });
});

/**
 * What a call-sequence recorder can honestly say about an effect pass.
 *
 * It cannot say a blur blurs — no pixel leaves this file. What it can pin is
 * every part of the contract that is invisible in a screenshot and silent when
 * broken: that nothing is allocated until a group asks, that the offscreen
 * buffer gets a stencil, that the passes ping-pong rather than reading the
 * buffer they are writing, and that the default framebuffer is bound again by
 * the end. A group whose effects leave an FBO bound paints the rest of the
 * frame into a texture nobody shows, and every existing test still passes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import { registerEffect } from './types';
import { _resetProgramRegistryForTests, registerProgram } from '../shaders/registerProgram';
import type { DrawCommand } from '../DrawCommand';
import { drawLayers, type LayerGroup } from '../../core/layers/render';
import type { RenderLayer } from '../../core/layers/render';

const TINT_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
out vec4 outColor;
void main() { outColor = texture(u_source, v_uv); }
`;

const RECT: DrawCommand = {
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
  fill: { color: '#f00' },
};

function setup(effectIds: string[]) {
  const recorder = makeGLRecorder();
  const renderer = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 50, dpr: 2 });
  const effects = effectIds.map((id) => ({ program: registerEffect(id, TINT_FRAG) }));
  return { recorder, renderer, effects };
}

beforeEach(() => {
  _resetProgramRegistryForTests();
  // The composite program registers itself at module load, and the reset above
  // clears it along with everything else.
  return import('./composite').then(() => undefined);
});

describe('group effects', () => {
  it('allocates nothing for a frame with no effects', () => {
    const { recorder, renderer } = setup([]);
    renderer.render([{ kind: 'group', children: [RECT] }]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).not.toContain('createFramebuffer');
    expect(names).not.toContain('createRenderbuffer');
  });

  it('allocates nothing for a group whose effects list is empty', () => {
    const { recorder, renderer } = setup([]);
    renderer.render([{ kind: 'group', effects: [], children: [RECT] }]);
    expect(recorder.calls.map((c) => c.name)).not.toContain('createFramebuffer');
  });

  it('gives the offscreen buffer a stencil attachment', () => {
    const { recorder, renderer, effects } = setup(['fx-stencil']);
    renderer.registerProgram(effects[0].program);
    renderer.render([{ kind: 'group', effects, children: [RECT] }]);

    const storage = recorder.calls.filter((c) => c.name === 'renderbufferStorage');
    expect(storage.length).toBeGreaterThan(0);
    expect(storage[0].args[1]).toBe(recorder.gl.DEPTH24_STENCIL8);
    const attach = recorder.calls.filter((c) => c.name === 'framebufferRenderbuffer');
    expect(attach.length).toBeGreaterThan(0);
    expect(attach[0].args[1]).toBe(recorder.gl.DEPTH_STENCIL_ATTACHMENT);
  });

  it('sizes the offscreen buffer in device pixels, not CSS pixels', () => {
    const { recorder, renderer, effects } = setup(['fx-size']);
    renderer.registerProgram(effects[0].program);
    renderer.render([{ kind: 'group', effects, children: [RECT] }]);

    const storage = recorder.calls.find((c) => c.name === 'renderbufferStorage')!;
    // 100 × 50 CSS at dpr 2.
    expect([storage.args[2], storage.args[3]]).toEqual([200, 100]);
  });

  it('binds the default framebuffer again once the group is composited', () => {
    const { recorder, renderer, effects } = setup(['fx-unbind']);
    renderer.registerProgram(effects[0].program);
    renderer.render([{ kind: 'group', effects, children: [RECT] }]);

    const binds = recorder.calls.filter((c) => c.name === 'bindFramebuffer');
    expect(binds.length).toBeGreaterThan(1);
    expect(binds[0].args[0]).toBe(recorder.gl.FRAMEBUFFER);
    expect(binds[binds.length - 1].args[1]).toBeNull();
  });

  it('ping-pongs: a pass never writes the buffer it is reading', () => {
    const { recorder, renderer, effects } = setup(['fx-a', 'fx-b']);
    for (const e of effects) renderer.registerProgram(e.program);
    renderer.render([{ kind: 'group', effects, children: [RECT] }]);

    // Walk the call log pairing each draw with the framebuffer bound at the
    // time and the texture bound to unit 0.
    let boundFbo: unknown = null;
    let boundTex: unknown = null;
    const fboOfTexture = new Map<unknown, unknown>();
    const pairs: { fbo: unknown; tex: unknown }[] = [];
    for (const call of recorder.calls) {
      if (call.name === 'bindFramebuffer') boundFbo = call.args[1];
      if (call.name === 'framebufferTexture2D') fboOfTexture.set(call.args[3], boundFbo);
      if (call.name === 'bindTexture') boundTex = call.args[1];
      if (call.name === 'drawElements' && boundFbo !== null) {
        pairs.push({ fbo: boundFbo, tex: boundTex });
      }
    }
    for (const { fbo, tex } of pairs) {
      expect(fboOfTexture.get(tex), 'a pass sampled the texture it was writing')
        .not.toBe(fbo);
    }
  });

  it('reuses one buffer pair across frames rather than allocating per frame', () => {
    const { recorder, renderer, effects } = setup(['fx-reuse']);
    renderer.registerProgram(effects[0].program);
    const tree: DrawCommand[] = [{ kind: 'group', effects, children: [RECT] }];
    renderer.render(tree);
    const first = recorder.calls.filter((c) => c.name === 'createFramebuffer').length;
    recorder.reset();
    renderer.render(tree);
    expect(recorder.calls.filter((c) => c.name === 'createFramebuffer')).toHaveLength(0);
    expect(first).toBeGreaterThan(0);
  });

  it('draws the children straight through when the effect program is missing', () => {
    const { recorder, renderer } = setup([]);
    // Registered as a source, never compiled onto this renderer, and the
    // fragment shader is nonsense so `ensureProgram` cannot rescue it.
    const program = registerProgram('fx-broken', 'not glsl', 'not glsl');
    renderer.render([{ kind: 'group', effects: [{ program }], children: [RECT] }]);
    // The rect still reached the buffer, and the frame ended on the default one.
    expect(recorder.calls.some((c) => c.name === 'drawElements')).toBe(true);
    const binds = recorder.calls.filter((c) => c.name === 'bindFramebuffer');
    expect(binds[binds.length - 1].args[1]).toBeNull();
  });
});

/**
 * What a shared pass costs, counted rather than described.
 *
 * A return to the default framebuffer is one composite, so counting those
 * counts brackets: three layers sharing a group come back once, the same three
 * carrying `effects` each come back three times. The first frame is discarded
 * because allocating a target also unbinds, and that is not a composite.
 */
describe('a group shared by several layers', () => {
  const CMD: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { color: '#f00' },
  };
  const IDS = ['a', 'b', 'c'];

  function compositesOnSecondFrame(
    layers: RenderLayer<unknown>[],
    groups?: LayerGroup[],
  ): number {
    const { recorder, renderer, effects } = setup(['fx-shared']);
    renderer.registerProgram(effects[0].program);
    const withFx = layers.map((l) => (l.effects ? { ...l, effects } : l));
    const withGroups = groups?.map((g) => ({ ...g, effects }));
    const draw = () => drawLayers(
      withFx, null, {}, undefined, undefined,
      { width: 100, height: 50 }, undefined, undefined, withGroups,
    );
    renderer.render(draw());
    recorder.reset();
    renderer.render(draw());
    return recorder.calls.filter(
      (c) => c.name === 'bindFramebuffer' && c.args[1] === null,
    ).length;
  }

  const plain = (id: string): RenderLayer<unknown> =>
    ({ id, label: id, space: 'screen', draw: () => [CMD] });
  // `effects` is a marker here; `compositesOnSecondFrame` swaps in the real one.
  const own = (id: string): RenderLayer<unknown> =>
    ({ ...plain(id), effects: [] as never });

  it('composites once for the whole run', () => {
    expect(compositesOnSecondFrame(
      IDS.map(plain),
      [{ id: 'world', layers: IDS }],
    )).toBe(1);
  });

  it('composites once per layer without one — the cost the group removes', () => {
    expect(compositesOnSecondFrame(IDS.map(own))).toBe(3);
  });

  it('leaves a layer outside the group out of the shared buffer', () => {
    // The HUD is drawn after the composite, so it is not among the group's
    // pixels — the one thing a CSS filter on the canvas cannot arrange.
    const { recorder, renderer, effects } = setup(['fx-outside']);
    renderer.registerProgram(effects[0].program);
    const layers = [...IDS.map(plain), plain('hud')];
    const groups = [{ id: 'world', layers: IDS, effects }];
    const cmds = drawLayers(
      layers, null, {}, undefined, undefined,
      { width: 100, height: 50 }, undefined, undefined, groups,
    );
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toMatchObject({ kind: 'group', effects });
    expect(cmds[1]).toBe(CMD);
    renderer.render(cmds);
    const binds = recorder.calls.filter((c) => c.name === 'bindFramebuffer');
    expect(binds[binds.length - 1].args[1]).toBeNull();
  });
});

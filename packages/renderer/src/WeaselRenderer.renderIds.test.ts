import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { ID_ATTRIBUTE_LOCATION } from './shaders/idOutput';
import { idMask } from './draw/idRender';

const rect = (x: number): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: 10, height: 10 },
  fill: { paint: { kind: 'solid', color: '#f00' } },
});
const tagged = (pickId: number, ...children: DrawCommand[]): DrawCommand => ({ kind: 'group', pickId, children });

function setup() {
  const rec = makeGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 50, dpr: 2 });
  rec.reset();
  return { rec, r, named: (name: string) => rec.calls.filter((c) => c.name === name) };
}

describe('WeaselRenderer.renderIds', () => {
  it('draws into a buffer of its own with ids beside color, and reads the ids back', () => {
    const { r, named, rec } = setup();
    const out = r.renderIds([tagged(7, rect(0))]);
    expect(out).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
    expect(out.data).toHaveLength(200 * 100);
    expect(named('framebufferTexture2D').map((c) => c.args[1])).toContain(rec.gl.COLOR_ATTACHMENT1);
    expect(named('readBuffer').map((c) => c.args[0])).toEqual([rec.gl.COLOR_ATTACHMENT1, rec.gl.COLOR_ATTACHMENT0]);
    expect(named('readPixels')[0].args.slice(0, 4)).toEqual([0, 0, 200, 100]);
  });

  it('gives each draw the id of the group it is in, closing a batched run where the id changes', () => {
    const { r, named } = setup();
    r.renderIds([tagged(1, rect(0), rect(20)), tagged(2, rect(40))]);
    const ids = named('vertexAttrib4f').filter((c) => c.args[0] === ID_ATTRIBUTE_LOCATION);
    // One per id, then the attribute put back at the end.
    expect(ids.map((c) => Math.round((c.args[1] as number) * 255))).toEqual([1, 2, 0]);
    expect(named('drawElements')).toHaveLength(2);
  });

  it('reads only the device pixels a rect touches, and draws only what can reach them', () => {
    const { r, named } = setup();
    const out = r.renderIds([tagged(1, rect(0)), tagged(2, rect(60))], undefined, { rect: { x: 65, y: 5, width: 0, height: 0 } });
    expect(out).toMatchObject({ x: 130, y: 10, width: 1, height: 1 });
    expect(named('scissor')[0].args).toEqual([130, 89, 1, 1]);
    expect(named('drawElements')).toHaveLength(1);
  });

  it('leaves the canvas and the last frame\'s stats alone', () => {
    const { r, named } = setup();
    r.render([rect(0)]);
    const stats = r.lastFrameStats();
    r.renderIds([tagged(1, rect(0))]);
    expect(r.lastFrameStats()).toBe(stats);
    expect(named('bindFramebuffer').at(-1)!.args[1]).toBeNull();
  });

  it('refuses an id an id frame cannot carry', () => {
    const { r } = setup();
    expect(() => r.renderIds([tagged(0x1000000, rect(0))])).toThrow(RangeError);
  });
});

describe('idMask', () => {
  it('marks the pixels holding an id it takes', () => {
    const buffer = { x: 0, y: 0, width: 4, height: 1, data: new Uint32Array([0, 3, 5, 3]) };
    expect([...idMask(buffer, new Set([3]))]).toEqual([0, 1, 0, 1]);
    expect([...idMask(buffer, (id) => id > 4)]).toEqual([0, 0, 1, 0]);
  });
});

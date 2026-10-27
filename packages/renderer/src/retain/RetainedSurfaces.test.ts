/**
 * What retained surfaces allocate, against the recording context: each
 * texture is the size of the rect its group can paint, and the scratch buffer
 * the size of the largest. It sees the sizes asked for, never a pixel; the
 * pixels are `contentBounded.browser.test.ts`'s.
 */
import { describe, expect, it } from 'vitest';
import { mat3, pathFromD } from '@weasel-js/geom';
import { makeGLRecorder } from '../testing/glRecorder';
import { RetainedSurfaces } from './RetainedSurfaces';
import type { RetainedKey } from './retainedKey';
import { contentBounds } from './contentBounds';
import type { DrawCommand } from '../DrawCommand';
import { blur, vignette } from '../effects/builtins';

const W = 800;
const H = 600;

function key(): RetainedKey {
  return {
    children: [], transform: mat3.identity(), alpha: 1, colorMatrix: new Float32Array(20),
    viewMatrix: undefined, clips: [],
  };
}

describe('RetainedSurfaces', () => {
  it('allocates each surface and the scratch buffer at the rect it covers, not the drawing buffer', () => {
    const rec = makeGLRecorder();
    const store = new RetainedSurfaces(rec.gl, Infinity);
    store.beginFrame([]);
    store.reserve('a', W, H, { x: 100, y: 50, width: 40, height: 30 })!.commit(key());

    const textures = rec.calls.filter((c) => c.name === 'texImage2D').map((c) => [c.args[3], c.args[4]]);
    const storage = rec.calls.filter((c) => c.name === 'renderbufferStorage').map((c) => [c.args[2], c.args[3]]);
    expect(textures).toEqual([[40, 30]]);
    expect(storage).toEqual([[40, 30], [40, 30]]);
    // The recorder reports no multisampling: 4 bytes a pixel kept, 8 drawn in.
    expect(store.bytes).toBe(40 * 30 * 4 + 40 * 30 * 8);
    expect(store.bytes).toBeLessThan(W * H * 4);
  });

  it('keeps one scratch buffer as large as the largest surface, and shrinks it when that one goes', () => {
    const rec = makeGLRecorder();
    const store = new RetainedSurfaces(rec.gl, Infinity);
    const k = key();
    store.beginFrame([]);
    store.reserve('big', W, H, { x: 0, y: 0, width: 40, height: 30 })!.commit(k);
    store.reserve('small', W, H, { x: 0, y: 0, width: 10, height: 10 })!.commit(k);
    store.endFrame();
    expect(store.bytes).toBe(40 * 30 * 4 + 10 * 10 * 4 + 40 * 30 * 8);

    store.beginFrame([]);
    expect(store.lookup('small', W, H, k)).toMatchObject({ kind: 'kept' });
    store.endFrame();
    expect(store.bytes).toBe(10 * 10 * 4);
  });

  it('holds no texture for a group with nothing on screen, and still keeps its key', () => {
    const rec = makeGLRecorder();
    const store = new RetainedSurfaces(rec.gl, Infinity);
    store.beginFrame([]);
    const draw = store.reserve('gone', W, H, { x: 0, y: 0, width: 0, height: 0 })!;
    expect(draw.fbo).toBeNull();
    const k = key();
    expect(draw.commit(k).texture).toBeNull();
    expect(rec.calls.some((c) => c.name === 'texImage2D' || c.name === 'createRenderbuffer')).toBe(false);
    expect(store.lookup('gone', W, H, k)).toMatchObject({ kind: 'kept', pixels: { texture: null } });
    expect(store.bytes).toBe(0);
  });

  it('counts the surfaces it keeps against the budget, not the scratch buffer they are drawn in', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, 40 * 30 * 4 + 10 * 10 * 4);
    store.beginFrame([]);
    expect(store.reserve('a', W, H, { x: 0, y: 0, width: 40, height: 30 })).not.toBeNull();
    expect(store.reserve('b', W, H, { x: 0, y: 0, width: 10, height: 11 })).toBeNull();
    expect(store.reserve('c', W, H, { x: 0, y: 0, width: 10, height: 10 })).not.toBeNull();
  });

  it('frees the scratch buffer after a frame that redraws nothing', () => {
    const rec = makeGLRecorder();
    const store = new RetainedSurfaces(rec.gl, Infinity);
    const k = key();
    store.beginFrame([]);
    store.reserve('a', W, H, { x: 0, y: 0, width: 40, height: 30 })!.commit(k);
    store.endFrame();
    expect(store.bytes).toBe(40 * 30 * 4 + 40 * 30 * 8);

    store.beginFrame([]);
    expect(store.lookup('a', W, H, k)).toMatchObject({ kind: 'kept' });
    store.endFrame();
    expect(store.bytes).toBe(40 * 30 * 4);
    expect(rec.calls.filter((c) => c.name === 'deleteRenderbuffer')).toHaveLength(2);
  });
});

const rect = (x: number, y: number, width: number, height: number): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width, height }, fill: { paint: { color: '#fff' } },
});

describe('contentBounds', () => {
  const I = mat3.identity();

  it('bounds paths through the transform at the device scale, a pixel of slack each side', () => {
    const m = mat3.translated(I, 10, 20);
    expect(contentBounds([rect(0, 0, 5, 5)], m, [], 2, 200, 200)).toEqual({ x: 18, y: 38, width: 14, height: 14 });
  });

  it('clamps to the drawing buffer, and is empty for content wholly off it', () => {
    expect(contentBounds([rect(90, -10, 50, 20)], I, [], 1, 100, 100)).toEqual({ x: 89, y: 0, width: 11, height: 11 });
    expect(contentBounds([rect(200, 0, 5, 5)], I, [], 1, 100, 100)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('cuts content to the clips around it, its own group clip included', () => {
    const clip = pathFromD('M10 10 L20 10 L20 20 L10 20 Z');
    expect(contentBounds([rect(0, 0, 100, 100)], I, [{ path: clip, transform: I }], 1, 100, 100))
      .toEqual({ x: 9, y: 9, width: 12, height: 12 });
    expect(contentBounds([{ kind: 'group', clip, children: [rect(0, 0, 100, 100)] }], I, [], 1, 100, 100))
      .toEqual({ x: 9, y: 9, width: 12, height: 12 });
  });

  it('is the whole buffer for what it cannot bound, unless a clip bounds it', () => {
    const shader: DrawCommand = {
      kind: 'shader', program: { id: 'x' }, uniforms: {}, bounds: { x: 0, y: 0, w: 1, h: 1 },
    };
    expect(contentBounds([rect(0, 0, 1, 1), shader], I, [], 1, 100, 80)).toEqual({ x: 0, y: 0, width: 100, height: 80 });
    const clip = pathFromD('M10 10 L20 10 L20 20 L10 20 Z');
    expect(contentBounds([shader], I, [{ path: clip, transform: I }], 1, 100, 80)).toEqual({ x: 9, y: 9, width: 12, height: 12 });
  });

  it('grows a group with effects by how far they reach, in device pixels', () => {
    // Two passes of 4 device pixels each, 4 CSS pixels at a scale of 2, plus the slack.
    const blurred: DrawCommand = { kind: 'group', effects: blur({ radius: 4 }), children: [rect(10, 10, 5, 5)] };
    expect(contentBounds([blurred], I, [], 2, 200, 200)).toEqual({ x: 10, y: 10, width: 30, height: 30 });
    const shaded: DrawCommand = { kind: 'group', effects: vignette({ amount: 1 }), children: [rect(10, 10, 5, 5)] };
    expect(contentBounds([shaded], I, [], 2, 200, 200)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });

  it('reaches as far as a stroke can', () => {
    const line: DrawCommand = {
      kind: 'path', path: pathFromD('M10 10 L20 10'), stroke: { paint: { color: '#fff' }, width: 2 },
    };
    // Width 2 times the miter limit of 4, plus the slack.
    expect(contentBounds([line], I, [], 1, 100, 100)).toEqual({ x: 1, y: 1, width: 28, height: 18 });
  });
});

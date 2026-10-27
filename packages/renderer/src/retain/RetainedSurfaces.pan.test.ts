/**
 * A retained surface standing in for its group moved, against the recording
 * context: which moves composite the old pixels shifted, which draw straight
 * through, and which draw again with a margin. The pixels themselves are
 * `retained.pan.browser.test.ts`'s.
 */
import { describe, expect, it } from 'vitest';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { makeGLRecorder } from '../testing/glRecorder';
import { PAN_MARGIN, RetainedSurfaces } from './RetainedSurfaces';
import type { RetainedKey } from './retainedKey';
import type { DeviceBox } from './contentBounds';
import type { DrawCommand } from '../DrawCommand';

const W = 800;
const H = 600;
const SCALE = 2;
const CHILDREN: DrawCommand[] = [];
const BUFFER = { x: 0, y: 0, width: W, height: H };
const MX = Math.round(W * PAN_MARGIN);
const MY = Math.round(H * PAN_MARGIN);
const GROWN = { x: -MX, y: -MY, width: W + 2 * MX, height: H + 2 * MY };

/** A key whose transform and view matrix both translate by `tx, ty` CSS px. */
function keyAt(tx: number, ty: number, zoom = 1): RetainedKey {
  const m: GlMat3 = mat3.scaled(mat3.translated(mat3.identity(), tx, ty), zoom, zoom);
  return {
    children: CHILDREN, transform: m, alpha: 1, colorMatrix: new Float32Array(20),
    viewMatrix: m.slice(), clips: [],
  };
}

/** Content running well past every edge of the buffer. */
const WIDE: DeviceBox = { x0: -2000, y0: -2000, x1: 3000, y1: 3000 };

function drawn(store: RetainedSurfaces, box: DeviceBox, window = BUFFER, at = keyAt(0, 0)) {
  store.beginFrame([]);
  const rect = { x: Math.max(window.x, box.x0), y: Math.max(window.y, box.y0), width: 0, height: 0 };
  rect.width = Math.min(window.x + window.width, box.x1) - rect.x;
  rect.height = Math.min(window.y + window.height, box.y1) - rect.y;
  store.reserve('a', W, H, rect, true, { box, window })!.commit(at);
  store.endFrame();
}

describe('a retained surface through a pan', () => {
  it('composites its pixels shifted for a whole-pixel move it covers', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, { x0: 100, y0: 100, x1: 200, y1: 150 });
    store.beginFrame([]);
    // 3.5 CSS px at 2x is 7 device px.
    const found = store.lookup('a', W, H, keyAt(3.5, -10), true, SCALE);
    expect(found).toEqual({ kind: 'kept', pixels: { texture: expect.anything(), rect: { x: 107, y: 80, width: 100, height: 50 } } });
    expect(store.composited).toBe(1);
  });

  it('draws again with a margin once a move outruns what was drawn', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, WIDE);
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1, 0), true, SCALE)).toEqual({ kind: 'redraw', window: GROWN });
  });

  it('then stands in for moves within the margin, and not past it', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, WIDE, GROWN);
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(MX / SCALE, -MY / SCALE), true, SCALE)).toMatchObject({ kind: 'kept' });
    expect(store.lookup('a', W, H, keyAt(MX / SCALE + 0.5, 0), true, SCALE)).toEqual({ kind: 'redraw', window: GROWN });
  });

  it('draws a fractional move straight through, and again once it holds a frame', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, WIDE, GROWN);
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(0.3, 0), true, SCALE)).toEqual({ kind: 'through' });
    expect(store.declined).toBe(1);
    store.endFrame();
    // Kept through the frame that did not use it.
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1, 0), true, SCALE)).toMatchObject({ kind: 'kept' });
    store.endFrame();
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1.3, 0), true, SCALE)).toEqual({ kind: 'through' });
    store.endFrame();
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1.3, 0), true, SCALE)).toEqual({ kind: 'redraw', window: GROWN });
  });

  it('never shifts a surface for a zoom, or for a group that may not move', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, { x0: 100, y0: 100, x1: 200, y1: 150 });
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(0, 0, 1.5), true, SCALE)).toEqual({ kind: 'redraw', window: BUFFER });
  });

  it('draws a group that may not move straight through while it moves, and again once it holds', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, { x0: 100, y0: 100, x1: 200, y1: 150 });
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1, 0))).toEqual({ kind: 'through' });
    store.endFrame();
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1, 0))).toEqual({ kind: 'redraw', window: BUFFER });
  });

  it('never shifts one whose view matrix stays put while the transform moves', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, Infinity);
    drawn(store, { x0: 100, y0: 100, x1: 200, y1: 150 });
    store.beginFrame([]);
    const k = { ...keyAt(1, 0), viewMatrix: mat3.identity() };
    expect(store.lookup('a', W, H, k, true, SCALE)).toMatchObject({ kind: 'redraw' });
  });

  it('cuts a margin that does not fit the budget back to the buffer, and then draws a pan straight through', () => {
    const store = new RetainedSurfaces(makeGLRecorder().gl, W * H * 4);
    drawn(store, WIDE);
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(1, 0), true, SCALE)).toEqual({ kind: 'redraw', window: GROWN });
    const draw = store.reserve('a', W, H, GROWN, true, { box: WIDE, window: GROWN })!;
    expect(draw.rect).toEqual(BUFFER);
    expect(store.declined).toBe(0);
    draw.commit(keyAt(1, 0));
    store.endFrame();
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(2, 0), true, SCALE)).toEqual({ kind: 'through' });
    store.endFrame();
    store.beginFrame([]);
    expect(store.lookup('a', W, H, keyAt(2, 0), true, SCALE)).toEqual({ kind: 'redraw', window: GROWN });
  });
});

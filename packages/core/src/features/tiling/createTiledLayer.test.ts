import { describe, it, expect, vi } from 'vitest';
import { createTiledLayer } from './createTiledLayer';
import { createParallaxLayer } from '../parallax/createParallaxLayer';
import type { DrawCommand } from '../../renderer';
import type { RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';

const dims = { width: 400, height: 300 };
const unit = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } } as DrawCommand;

function spyLayer(space: 'world' | 'screen' = 'world') {
  const draw = vi.fn((_d: unknown, _v: View, _dims: { width: number; height: number }) => [unit]);
  const layer: RenderLayer<unknown> = { id: 'src', label: 'src', space, draw };
  return { layer, draw };
}

/** Column-major translation, so `[6]` and `[7]` are tx and ty. */
function offsetOf(cmd: DrawCommand): [number, number] {
  const t = (cmd as { transform?: Float32Array }).transform;
  return t ? [t[6]!, t[7]!] : [0, 0];
}

describe('createTiledLayer', () => {
  it('declares space: world, so it can be a parallax source', () => {
    const l = createTiledLayer({ id: 't', label: 'T', source: [], period: 100 });
    expect(l.space).toBe('world');
  });

  it('draws one copy per visible cell, translated by the period', () => {
    const { layer, draw } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 200 });
    const out = l.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(out.map(offsetOf)).toEqual([[0, 0], [200, 0], [400, 0]]);
  });

  it('shifts the view it hands each copy, so the source culls per copy', () => {
    const { layer, draw } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 200 });
    l.draw(undefined, { x: 500, y: 0, scale: { x: 1, y: 1 } }, dims);
    const xs = draw.mock.calls.map((c) => c[1].x);
    expect(xs).toEqual([100, -100, -300]);
  });

  it('a bare number wraps x only', () => {
    const { layer } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 200 });
    const out = l.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims);
    expect(out.every((c) => offsetOf(c)[1] === 0)).toBe(true);
  });

  it('wraps both axes when the period names both', () => {
    const { layer } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: { x: 400, y: 300 } });
    const out = l.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims);
    expect(out.map(offsetOf)).toEqual([[0, 0], [0, 300], [400, 0], [400, 300]]);
  });

  it('wraps y alone when only `y` is named', () => {
    const { layer } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: { y: 300 } });
    const out = l.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims);
    expect(out.map(offsetOf)).toEqual([[0, 0], [0, 300]]);
  });

  it('reads a period function per draw, against the live view and dims', () => {
    const period = vi.fn(() => 200);
    const { layer } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period });
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    l.draw(undefined, view, dims);
    l.draw(undefined, view, dims);
    expect(period).toHaveBeenCalledTimes(2);
    expect(period.mock.calls[0]).toEqual([view, dims]);
  });

  it('bleed pulls in the copies whose content overhangs the cell', () => {
    const { layer } = spyLayer();
    const plain = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 500 });
    const bled = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 500, bleed: 200 });
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(plain.draw(undefined, view, dims).map(offsetOf)).toEqual([[0, 0]]);
    expect(bled.draw(undefined, view, dims).map(offsetOf)).toEqual([[-500, 0], [0, 0], [500, 0]]);
  });

  it('accounts for zoom: a zoomed-out view sees more copies', () => {
    const { layer } = spyLayer();
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 200 });
    const near = l.draw(undefined, { x: 0, y: 0, scale: { x: 2, y: 2 } }, dims);
    const far = l.draw(undefined, { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } }, dims);
    expect(far.length).toBeGreaterThan(near.length);
  });

  it('draws a screen-space source once, untiled', () => {
    const { layer, draw } = spyLayer('screen');
    const l = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 200 });
    const out = l.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims);
    expect(draw).toHaveBeenCalledOnce();
    expect(out).toEqual([unit]);
  });

  it('emits nothing for a source that drew nothing', () => {
    const empty: RenderLayer<unknown> = { id: 'e', label: 'e', space: 'world', draw: () => [] };
    const l = createTiledLayer({ id: 't', label: 'T', source: [empty], period: 200 });
    expect(l.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims)).toEqual([]);
  });

  it('composes under createParallaxLayer: the lattice resolves against the derived view', () => {
    const { layer, draw } = spyLayer();
    const tiled = createTiledLayer({ id: 't', label: 'T', source: [layer], period: 200 });
    const plane = createParallaxLayer({ id: 'p', label: 'P', source: [tiled], pan: 0.5 });
    plane.draw(undefined, { x: 1000, y: 0, scale: { x: 1, y: 1 } }, dims);
    // pan 0.5 puts the plane's camera at x = 500, so the first visible copy is
    // the one covering [400, 600) — index 2.
    const xs = draw.mock.calls.map((c) => c[1].x);
    expect(xs).toEqual([100, -100, -300]);
  });
});

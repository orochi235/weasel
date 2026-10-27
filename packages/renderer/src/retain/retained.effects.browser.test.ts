/**
 * Retained groups and the surfaces groups own, against real WebGL2: a group
 * with effects or `isolate` keeps what its own surface composites, and a
 * retained group inside another group's effects buffer composites into that
 * buffer. The whole buffer is compared channel by channel with drawing the
 * same commands with no `retain` anywhere.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { blur, vignette } from '../effects/builtins';

const W = 48;
const H = 32;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;

const BELOW: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
  { kind: 'path', path: pathFromD('M40 2 A8 8 0 1 1 39.99 2 Z'), fill: { paint: { color: '#ffcc00' } } },
];

const CHILDREN: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 10, y: 8, width: 12, height: 10 }, fill: { paint: { color: 'rgba(255, 0, 0, 0.7)' } } },
  { kind: 'path', path: pathFromD('M6 26 L30 14'), stroke: { paint: { color: '#ffffff' }, width: 1.5 } },
];

let renderer: WeaselRenderer | undefined;
let gl: WebGL2RenderingContext;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

function open(): WeaselRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: DPR });
  return renderer;
}

function frame(r: WeaselRenderer, commands: DrawCommand[]): Uint8Array {
  r.render(commands);
  const px = new Uint8Array(DW * DH * 4);
  gl.readPixels(0, 0, DW, DH, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

function maxDiff(a: Uint8Array, b: Uint8Array): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

/** Draw `make()` straight through, then with `retain` twice: the pixels each
 *  left and the last frame's stats. */
function compare(r: WeaselRenderer, make: (retain?: string) => DrawCommand) {
  const direct = frame(r, [...BELOW, make()]);
  frame(r, [...BELOW, make('layer')]);
  const kept = frame(r, [...BELOW, make('layer')]);
  return { direct, kept, stats: r.lastFrameStats().retained };
}

describe('a retained group that owns a surface, in a real context', () => {
  it('keeps a blurred group\'s composite, bounded by the blur\'s reach', () => {
    const effects = blur({ radius: 3 });
    const { direct, kept, stats } = compare(open(), (retain) => ({ kind: 'group', retain, effects, alpha: 0.8, children: CHILDREN }));
    expect(stats).toMatchObject({ composited: 1, redrawn: 0, declined: 0 });
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(2);
    expect(stats.bytes).toBeLessThan(DW * DH * 4);
  });

  it('matches an effects list rebuilt each frame with the same passes', () => {
    const r = open();
    const make = (retain?: string): GroupDrawCommand => ({ kind: 'group', retain, effects: blur({ radius: 3 }), children: CHILDREN });
    const { direct, kept, stats } = compare(r, make);
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(2);
    frame(r, [...BELOW, { kind: 'group', retain: 'layer', effects: blur({ radius: 5 }), children: CHILDREN }]);
    expect(r.lastFrameStats().retained.redrawn).toBe(1);
  });

  it('keeps a whole-buffer surface for an effect that does not say how far it reaches', () => {
    const effects = vignette({ amount: 0.8 });
    const { direct, kept, stats } = compare(open(), (retain) => ({ kind: 'group', retain, effects, children: CHILDREN }));
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(2);
    expect(stats.bytes).toBeGreaterThanOrEqual(DW * DH * 4);
  });

  it('keeps an isolated, translucent group inside its clip', () => {
    const clip = pathFromD('M20 4 A12 12 0 1 1 19.99 4 Z');
    const { direct, kept, stats } = compare(open(), (retain) => ({ kind: 'group', retain, isolate: true, alpha: 0.5, clip, children: CHILDREN }));
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(8);
  });

  it('composites into the effects buffer of a group around it', () => {
    const effects = blur({ radius: 2 });
    const { direct, kept, stats } = compare(open(), (retain) => ({
      kind: 'group', effects,
      children: [{ kind: 'group', retain, children: CHILDREN }],
    }));
    expect(stats).toMatchObject({ composited: 1, declined: 0 });
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(8);
  });

  it('draws what lies past the edge into a surface inside an effects buffer', () => {
    // Above the buffer but for its last rows: the blur reaching in is mostly
    // what lies past the edge, which a surface cut at the edge does not hold.
    const above: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 8, y: -10, width: 30, height: 11 }, fill: { paint: { color: '#ff0000' } } },
    ];
    const effects = blur({ radius: 6 });
    const r = open();
    const make = (retain?: string): DrawCommand => ({ kind: 'group', effects, children: [{ kind: 'group', retain, children: above }] });
    const direct = frame(r, [...BELOW, make()]);
    const first = frame(r, [...BELOW, make('layer')]);
    const kept = frame(r, [...BELOW, make('layer')]);
    expect(r.lastFrameStats().retained).toMatchObject({ composited: 1, declined: 0 });
    expect(maxDiff(direct, first)).toBeLessThanOrEqual(8);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(8);
  });

  it('draws a retained group inside another one straight through', () => {
    const r = open();
    const nested: DrawCommand[] = [{ kind: 'group', retain: 'inner', children: CHILDREN }];
    const direct = frame(r, [...BELOW, { kind: 'group', children: [{ kind: 'group', children: CHILDREN }] }]);
    frame(r, [...BELOW, { kind: 'group', retain: 'outer', children: nested }]);
    expect(r.lastFrameStats().retained).toMatchObject({ redrawn: 1, declined: 1 });
    const kept = frame(r, [...BELOW, { kind: 'group', retain: 'outer', children: nested }]);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(8);
  });
});

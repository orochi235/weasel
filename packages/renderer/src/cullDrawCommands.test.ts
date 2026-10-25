import { describe, it, expect } from 'vitest';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from './DrawCommand';
import { cullDrawCommands } from './cullDrawCommands';
import { strokeReachAt } from './paintedBounds';
import { mat3 } from '@weasel-js/geom';
import { PATH_M, PATH_L, PATH_C } from '@weasel-js/geom';
import { blur, vignette } from './effects/builtins';

const SCREEN = { x: 0, y: 0, width: 800, height: 600 };
const paint = { color: '#000000' };

const rect = (x: number, y: number, width = 10, height = 10): PathDrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width, height },
  fill: { paint: paint },
});

const I = mat3.identity();

describe('strokeReachAt', () => {
  it('reaches as far as the wider side of a vertexWidths pair', () => {
    const plain = strokeReachAt({ paint, width: 4, miterLimit: 1 }, 1);
    const sided = strokeReachAt({ paint, width: 4, miterLimit: 1, vertexWidths: [{ left: 1, right: 20 }, 4] }, 1);
    expect(sided).toBeGreaterThan(plain);
    expect(sided).toBeCloseTo(40 * Math.SQRT2, 6);
  });
});

describe('cullDrawCommands', () => {
  it('drops a path wholly outside the screen and keeps one inside', () => {
    const inside = rect(100, 100);
    const far = rect(5000, 100);
    expect(cullDrawCommands([inside, far], I, SCREEN, 1)).toEqual([inside]);
  });

  it('keeps a path whose edge only just reaches in', () => {
    const edge = rect(799.5, 100);
    const above = rect(100, -9.5);
    expect(cullDrawCommands([edge, above], I, SCREEN, 1)).toEqual([edge, above]);
  });

  it('returns the same array when nothing is dropped', () => {
    const cmds: DrawCommand[] = [rect(10, 10), { kind: 'group', children: [rect(20, 20)] }];
    expect(cullDrawCommands(cmds, I, SCREEN, 1)).toBe(cmds);
  });

  it('keeps a path off-screen whose stroke reaches in', () => {
    // Geometry ends 20px left of the screen; a 12-wide miter stroke reaches
    // up to 4 * 12 = 48 past it.
    const stroked: PathDrawCommand = { ...rect(-30, 100), stroke: { width: 12, paint } };
    expect(cullDrawCommands([stroked], I, SCREEN, 1)).toEqual([stroked]);
    const thin: PathDrawCommand = { ...rect(-100, 100), stroke: { width: 1, paint } };
    expect(cullDrawCommands([thin], I, SCREEN, 1)).toEqual([]);
  });

  it('resolves a { px } stroke against the accumulated scale', () => {
    // At 0.1x, 20px of stroke is 200 world units, reaching 800 out.
    const zoomedOut = mat3.scaled(I, 0.1, 0.1);
    const stroked: PathDrawCommand = { ...rect(-700, 100), stroke: { width: { px: 20 }, paint } };
    expect(cullDrawCommands([stroked], zoomedOut, SCREEN, 1)).toEqual([stroked]);
  });

  // At 1:16 the mean scale is 4, so a 30px stroke resolved through it is 7.5
  // world units — but across x, where a unit is one pixel, it paints 15px
  // either side of the line, and the line is only 12 off the screen.
  it('measures a { px } stroke along the axis the transform shrinks most', () => {
    const tall = mat3.scaled(mat3.identity(), 1, 16);
    const stroked: PathDrawCommand = {
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([-12, 0, -12, 10]),
        fillRule: 'nonzero',
      },
      stroke: { width: { px: 30 }, miterLimit: 1, paint },
    };
    expect(cullDrawCommands([stroked], tall, SCREEN, 1)).toEqual([stroked]);
  });

  describe('a stroke carrying a marker', () => {
    // A line 60 above the screen; an arrow spans 1.5 size units either side of
    // it, so a size-60 head reaches 90 down — 30 into the screen.
    const line = (stroke: PathDrawCommand['stroke']): PathDrawCommand => ({
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([100, -60, 300, -60]),
        fillRule: 'nonzero',
      },
      stroke,
    });

    it('keeps a path off-screen whose head reaches in', () => {
      const marked = line({ width: 1, paint, markerEnd: { key: 'arrow', size: 60 } });
      expect(cullDrawCommands([marked], I, SCREEN, 1)).toEqual([marked]);
      expect(cullDrawCommands([line({ width: 1, paint })], I, SCREEN, 1)).toEqual([]);
    });

    it('resolves a { px } head against the accumulated scale', () => {
      // At 4x the line sits 240 above the screen, and a 60px head reaches 90.
      const zoomed = mat3.scaled(I, 4, 4);
      const marked = line({ width: 1, paint, markerEnd: { key: 'arrow', size: { px: 60 } } });
      expect(cullDrawCommands([marked], zoomed, SCREEN, 1)).toEqual([]);
    });
  });

  // At 1:16 a screen pixel across x is a whole world unit, where the mean
  // scale of 4 makes it a quarter. A line 40px left of the screen, running
  // down; an arrow reaches 3 size units from its tip.
  describe('a head sized in other units than its line, at 1:16', () => {
    const tall = mat3.scaled(mat3.identity(), 1, 16);
    const down = (stroke: PathDrawCommand['stroke']): PathDrawCommand => ({
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([-40, 0, -40, 10]),
        fillRule: 'nonzero',
      },
      stroke,
    });

    it('measures a { px } head on a world-width line on screen', () => {
      // A 30px head reaches 90px across, where the mean scale made it 22.5.
      const marked = down({ width: 0.1, paint, markerEnd: { key: 'arrow', size: { px: 30 } } });
      expect(cullDrawCommands([marked], tall, SCREEN, 1)).toEqual([marked]);
    });

    it('measures a world-sized head on a { px } line in world', () => {
      // A 10-unit head reaches 30 world units, 30px across: 10 short of the
      // screen. Taken as screen-sized, it reached 120.
      const marked = down({ width: { px: 1 }, paint, markerEnd: { key: 'arrow', size: 10 } });
      expect(cullDrawCommands([marked], tall, SCREEN, 1)).toEqual([]);
    });
  });

  it('bounds a polygon by its control points', () => {
    const curve: PathDrawCommand = {
      kind: 'path',
      // A cubic from (-50, 50) to (900, 50): both end points are off-screen,
      // and the curve crosses the screen through its control points.
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_C]),
        coords: new Float32Array([-50, 50, -50, -50, 900, -50, 900, 50]),
        fillRule: 'nonzero',
      },
      fill: { paint: paint },
    };
    expect(cullDrawCommands([curve], I, SCREEN, 1)).toEqual([curve]);
  });

  it('carries group transforms, and bounds a rotation by its corners', () => {
    // A 400-long bar rotated 90° about its left end at x = 820 covers
    // x = 816..820 — still off-screen. Rotated 135° about x = 810, its far
    // end swings back to x ≈ 527.
    const bar = rect(0, 0, 400, 4);
    const offscreen: GroupDrawCommand = {
      kind: 'group',
      transform: mat3.multiply(mat3.translated(I, 820, 0), rotation(Math.PI / 2)),
      children: [bar],
    };
    const swungIn: GroupDrawCommand = {
      kind: 'group',
      transform: mat3.multiply(mat3.translated(I, 810, 0), rotation((3 * Math.PI) / 4)),
      children: [bar],
    };
    expect(cullDrawCommands([offscreen, swungIn], I, SCREEN, 1)).toEqual([swungIn]);
  });

  it('drops a group whose children all go, and keeps the survivors of one that is split', () => {
    const near = rect(10, 10);
    const split: GroupDrawCommand = { kind: 'group', alpha: 0.5, children: [near, rect(-900, 0)] };
    const gone: GroupDrawCommand = { kind: 'group', children: [rect(-900, 0)] };
    expect(cullDrawCommands([split, gone], I, SCREEN, 1)).toEqual([{ ...split, children: [near] }]);
  });

  describe('a group with effects', () => {
    // Six device pixels of reach: two passes, three each.
    const blurred = (x: number, children: DrawCommand[] = [rect(x, 100)]): GroupDrawCommand => ({
      kind: 'group', effects: blur({ radius: 3 }), children,
    });

    it('is kept while its reach crosses the edge, in device pixels', () => {
      // 5 CSS pixels past the right edge, 1 of them slack: 6 device pixels reach it at DPR 1, not at 2.
      const near = blurred(805);
      expect(cullDrawCommands([near], I, SCREEN, 1)).toEqual([near]);
      expect(cullDrawCommands([near], I, SCREEN, 2)).toEqual([]);
      const nearer = blurred(803);
      expect(cullDrawCommands([nearer], I, SCREEN, 2)).toEqual([nearer]);
    });

    it('is culled far off at any density', () => {
      for (const dpr of [1, 2]) expect(cullDrawCommands([blurred(-900)], I, SCREEN, dpr)).toEqual([]);
    });

    it('is kept whole, its children uncut, when it touches the screen', () => {
      const split = blurred(0, [rect(10, 10), rect(-900, 0)]);
      expect(cullDrawCommands([split], I, SCREEN, 1)).toEqual([split]);
    });

    it('measures its reach in screen space, under the group transforms around it', () => {
      const zoomed: GroupDrawCommand = { kind: 'group', transform: mat3.scaled(I, 4, 4), children: [blurred(202)] };
      // The rect lands at 808: 6 device pixels at DPR 1 do not reach.
      expect(cullDrawCommands([zoomed], I, SCREEN, 1)).toEqual([]);
    });

    it('is kept wherever it is when an effect does not say how far it reaches', () => {
      const shaded: GroupDrawCommand = { kind: 'group', effects: vignette({ amount: 1 }), children: [rect(-900, 0)] };
      expect(cullDrawCommands([shaded], I, SCREEN, 2)).toEqual([shaded]);
    });
  });

  it('keeps text and shader commands, which it cannot bound', () => {
    const text = { kind: 'text', x: -5000, y: -5000, runs: [], style: {} } as unknown as DrawCommand;
    const shader = {
      kind: 'shader', program: {}, uniforms: {}, bounds: { x: -5000, y: 0, w: 1, h: 1 },
    } as unknown as DrawCommand;
    expect(cullDrawCommands([text, shader], I, SCREEN, 1)).toEqual([text, shader]);
  });

  it('bounds images and sprite runs by their quads', () => {
    const image = { kind: 'image', image: {}, x: 900, y: 0, w: 10, h: 10 } as unknown as DrawCommand;
    const sprites = {
      kind: 'sprites',
      image: {},
      // Two sprites: one far left, one inside.
      sprites: new Float32Array([-900, 0, 10, 10, 0, 0, 1, 1, 1, 100, 100, 10, 10, 0, 0, 1, 1, 1]),
    } as unknown as DrawCommand;
    const farSprites = {
      kind: 'sprites',
      image: {},
      sprites: new Float32Array([-900, 0, 10, 10, 0, 0, 1, 1, 1]),
    } as unknown as DrawCommand;
    expect(cullDrawCommands([image, sprites, farSprites], I, SCREEN, 1)).toEqual([sprites]);
  });

  it('keeps a command whose bounds are not finite numbers', () => {
    const broken = rect(NaN, 0);
    expect(cullDrawCommands([broken], I, SCREEN, 1)).toEqual([broken]);
  });
});

function rotation(theta: number) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]);
}

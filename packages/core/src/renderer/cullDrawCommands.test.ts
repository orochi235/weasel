import { describe, it, expect } from 'vitest';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from './DrawCommand';
import { cullDrawCommands } from './cullDrawCommands';
import { mat3 } from './math/mat3';
import { PATH_M, PATH_C } from '@weasel-js/core';

const SCREEN = { x: 0, y: 0, width: 800, height: 600 };
const paint = { color: '#000000' };

const rect = (x: number, y: number, width = 10, height = 10): PathDrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width, height },
  fill: paint,
});

const I = mat3.identity();

describe('cullDrawCommands', () => {
  it('drops a path wholly outside the screen and keeps one inside', () => {
    const inside = rect(100, 100);
    const far = rect(5000, 100);
    expect(cullDrawCommands([inside, far], I, SCREEN)).toEqual([inside]);
  });

  it('keeps a path whose edge only just reaches in', () => {
    const edge = rect(799.5, 100);
    const above = rect(100, -9.5);
    expect(cullDrawCommands([edge, above], I, SCREEN)).toEqual([edge, above]);
  });

  it('returns the same array when nothing is dropped', () => {
    const cmds: DrawCommand[] = [rect(10, 10), { kind: 'group', children: [rect(20, 20)] }];
    expect(cullDrawCommands(cmds, I, SCREEN)).toBe(cmds);
  });

  it('keeps a path off-screen whose stroke reaches in', () => {
    // Geometry ends 20px left of the screen; a 12-wide miter stroke reaches
    // up to 4 * 12 = 48 past it.
    const stroked: PathDrawCommand = { ...rect(-30, 100), stroke: { width: 12, paint } };
    expect(cullDrawCommands([stroked], I, SCREEN)).toEqual([stroked]);
    const thin: PathDrawCommand = { ...rect(-100, 100), stroke: { width: 1, paint } };
    expect(cullDrawCommands([thin], I, SCREEN)).toEqual([]);
  });

  it('resolves a { px } stroke against the accumulated scale', () => {
    // At 0.1x, 20px of stroke is 200 world units, reaching 800 out.
    const zoomedOut = mat3.scaled(I, 0.1, 0.1);
    const stroked: PathDrawCommand = { ...rect(-700, 100), stroke: { width: { px: 20 }, paint } };
    expect(cullDrawCommands([stroked], zoomedOut, SCREEN)).toEqual([stroked]);
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
      fill: paint,
    };
    expect(cullDrawCommands([curve], I, SCREEN)).toEqual([curve]);
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
    expect(cullDrawCommands([offscreen, swungIn], I, SCREEN)).toEqual([swungIn]);
  });

  it('drops a group whose children all go, and keeps the survivors of one that is split', () => {
    const near = rect(10, 10);
    const split: GroupDrawCommand = { kind: 'group', alpha: 0.5, children: [near, rect(-900, 0)] };
    const gone: GroupDrawCommand = { kind: 'group', children: [rect(-900, 0)] };
    expect(cullDrawCommands([split, gone], I, SCREEN)).toEqual([{ ...split, children: [near] }]);
  });

  it('keeps a group with effects whole — an effect may move pixels', () => {
    const shadowed: GroupDrawCommand = {
      kind: 'group',
      effects: [{ program: {} as never }],
      children: [rect(-900, 0)],
    };
    expect(cullDrawCommands([shadowed], I, SCREEN)).toEqual([shadowed]);
  });

  it('keeps text and shader commands, which it cannot bound', () => {
    const text = { kind: 'text', x: -5000, y: -5000, runs: [], style: {} } as unknown as DrawCommand;
    const shader = {
      kind: 'shader', program: {}, uniforms: {}, bounds: { x: -5000, y: 0, w: 1, h: 1 },
    } as unknown as DrawCommand;
    expect(cullDrawCommands([text, shader], I, SCREEN)).toEqual([text, shader]);
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
    expect(cullDrawCommands([image, sprites, farSprites], I, SCREEN)).toEqual([sprites]);
  });

  it('keeps a command whose bounds are not finite numbers', () => {
    const broken = rect(NaN, 0);
    expect(cullDrawCommands([broken], I, SCREEN)).toEqual([broken]);
  });
});

function rotation(theta: number) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]);
}

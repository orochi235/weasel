import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { blur } from '../effects/builtins';
import { boxTree, cullToTile } from './tileCull';

const rect = (x: number, y: number): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width: 10, height: 10 }, fill: { paint: { color: '#fff' } },
});
const I = mat3.identity();
/** At scale 2, the left and right halves of a 200x100 device buffer. */
const LEFT = { x: 0, y: 0, width: 100, height: 100 };
const RIGHT = { x: 100, y: 0, width: 100, height: 100 };

describe('cullToTile', () => {
  it('drops commands missing a tile at any depth, and keeps the arrays a tile needs whole', () => {
    const inner: DrawCommand = { kind: 'group', transform: mat3.translated(I, 5, 0), children: [rect(0, 0), rect(80, 20)] };
    const cmds: DrawCommand[] = [rect(10, 10), inner, rect(70, 30)];
    const tree = boxTree(cmds, I, 2);
    const left = cullToTile(tree, LEFT);
    expect(left).toHaveLength(2);
    expect(left[0]).toBe(cmds[0]);
    expect((left[1] as { children: DrawCommand[] }).children).toEqual([rect(0, 0)]);
    const right = cullToTile(tree, RIGHT);
    expect(right).toHaveLength(2);
    expect((right[0] as { children: DrawCommand[] }).children).toEqual([rect(80, 20)]);
    expect(right[1]).toBe(cmds[2]);
    expect(cullToTile(tree, { x: 0, y: 0, width: 200, height: 100 })).toBe(cmds);
  });

  it('drops a group whose children all miss, and keeps a group with effects or isolation whole', () => {
    const blurred: DrawCommand = { kind: 'group', effects: blur({ radius: 2 }), children: [rect(0, 0), rect(80, 0)] };
    const isolated: DrawCommand = { kind: 'group', isolate: true, children: [rect(0, 20), rect(80, 20)] };
    const away: DrawCommand = { kind: 'group', children: [rect(0, 40)] };
    const tree = boxTree([blurred, isolated, away], I, 2);
    const right = cullToTile(tree, RIGHT);
    expect(right).toEqual([blurred, isolated]);
    expect(right[0]).toBe(blurred);
    expect(right[1]).toBe(isolated);
  });
});

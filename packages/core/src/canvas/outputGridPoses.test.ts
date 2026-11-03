import { describe, expect, it, vi } from 'vitest';
import { asNodeId, type NodeId, type RectPose } from 'core/scene/types';
import { snapPosesToGrid, withPoses } from './outputGridPoses';

const grid = { pitch: 0.4, origin: { x: 0.13, y: 0.07 } };
const dots = (v: number, origin: number) => (v - origin) / grid.pitch;
const whole = (v: number, origin: number) => Math.abs(dots(v, origin) - Math.round(dots(v, origin))) < 1e-9;
const lookup = (poses: Record<string, RectPose>) => (id: NodeId) => poses[id];

describe('snapPosesToGrid', () => {
  it('lays a run out in whole modules, every bar of one module the same dot count', () => {
    const module = 0.55;
    const poses: Record<string, RectPose> = {};
    const ids: NodeId[] = [];
    let x = 20.21;
    for (const [i, m] of [1, 2, 1, 1, 3, 1, 1, 1].entries()) {
      if (i % 2 === 0) {
        poses[`b${i}`] = { x, y: 5.03, width: m * module, height: 10 };
        ids.push(asNodeId(`b${i}`));
      }
      x += m * module;
    }
    const out = snapPosesToGrid(lookup(poses), grid, { runs: [{ ids: [...ids].reverse(), module }] });
    expect(out.size).toBe(4);
    const widths = ids.map((id) => Math.round(out.get(id)!.width / grid.pitch));
    expect(widths).toEqual([1, 1, 3, 1]);
    for (const p of out.values()) {
      for (const v of [p.x, p.x + p.width]) expect(whole(v, grid.origin.x)).toBe(true);
      for (const v of [p.y, p.y + p.height]) expect(whole(v, grid.origin.y)).toBe(true);
    }
  });

  it('keeps a hairline rule at one dot, and leaves its other fields alone', () => {
    const out = snapPosesToGrid(lookup({ r: { x: 1, y: 3.31, width: 50, height: 0.1, rotation: 0 } }), grid, { rects: [asNodeId('r')] });
    const r = out.get(asNodeId('r'))!;
    expect(r.height).toBeCloseTo(grid.pitch, 9);
    expect(r.rotation).toBe(0);
    expect(whole(r.y, grid.origin.y)).toBe(true);
  });

  it('snaps a quarter-turned mark by the box it covers, and skips one at any other angle', () => {
    const poses = {
      q: { x: 10, y: 10, width: 4.1, height: 0.1, rotation: Math.PI / 2 },
      t: { x: 10, y: 10, width: 4.1, height: 0.1, rotation: 0.3 },
    };
    const out = snapPosesToGrid(lookup(poses), grid, { rects: [asNodeId('q'), asNodeId('t')] });
    expect(out.has(asNodeId('t'))).toBe(false);
    const q = out.get(asNodeId('q'))!;
    // On screen it is a vertical hairline: its width on the page is `height`.
    expect(q.height).toBeCloseTo(grid.pitch, 9);
    const left = q.x + q.width / 2 - q.height / 2;
    expect(whole(left, grid.origin.x)).toBe(true);
  });
});

describe('withPoses', () => {
  it('draws a node it holds at the held pose, and others at their own', () => {
    const drawOne = vi.fn(() => []);
    const held = { x: 1, y: 2, width: 3, height: 4 };
    const wrapped = withPoses(new Map([[asNodeId('a'), held]]), drawOne);
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const own = { x: 9, y: 9, width: 9, height: 9 };
    wrapped({ id: asNodeId('a') } as never, own, view);
    wrapped({ id: asNodeId('b') } as never, own, view);
    expect(drawOne.mock.calls.map((c) => (c as unknown[])[1])).toEqual([held, own]);
    expect(withPoses(undefined, drawOne)).toBe(drawOne);
  });
});

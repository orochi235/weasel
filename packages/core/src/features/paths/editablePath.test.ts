import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import type { GesturePreviewSource } from 'canvas/gestureBounds';
import { liveEditablePath, resolveEditablePathOf, storeEditablePath } from './editablePath';

/** A triangle filling a 10x10 box, with its apex at `apexX` along the bottom edge. */
const tri = (apexX = 10): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: apexX, y: 10 }]) as PolygonPath;
const coords = (p: PolygonPath | null): number[] => Array.from(p!.coords);
const rect = (x: number) => ({ x, y: 0, width: 10, height: 10 });

describe('liveEditablePath', () => {
  it('is null for a node that is gone, and for one with no polygon', () => {
    expect(liveEditablePath('a', undefined, [], null)).toBeNull();
    expect(liveEditablePath('a', { pose: rect(0), data: {} }, [], null)).toBeNull();
  });

  it('is the committed path in world coords when nothing previews the node', () => {
    const node = { pose: rect(100), data: { path: tri() } };
    const other: GesturePreviewSource = { previewIds: () => ['b'], previewPose: () => rect(500) };
    expect(coords(liveEditablePath('a', node, [other], null))).toEqual([100, 0, 110, 0, 110, 10]);
  });

  it('follows the pose and the data a handle previews for the node', () => {
    const node = { pose: rect(100), data: { path: tri() } };
    const moving: GesturePreviewSource = { previewIds: () => ['a'], previewPose: () => rect(200) };
    expect(coords(liveEditablePath('a', node, [moving], null))).toEqual([200, 0, 210, 0, 210, 10]);

    const editing: GesturePreviewSource = { previewIds: () => ['a'], previewData: () => ({ path: tri(5) }) };
    expect(coords(liveEditablePath('a', node, [editing], null))).toEqual([100, 0, 110, 0, 105, 10]);
  });

  it('takes the first previewed pose and the last previewed data', () => {
    const node = { pose: rect(0), data: { path: tri() } };
    const first: GesturePreviewSource = {
      previewIds: () => ['a'], previewPose: () => rect(200), previewData: () => ({ path: tri(1) }),
    };
    const second: GesturePreviewSource = {
      previewIds: () => ['a'], previewPose: () => rect(900), previewData: () => ({ path: tri(2) }),
    };
    expect(coords(liveEditablePath('a', node, [first, second], null))).toEqual([200, 0, 210, 0, 202, 10]);
  });

  it('carries a path stored in a parallax plane into the asking camera', () => {
    const node = { pose: tri(), data: null };
    const plane = { scale: { x: 2, y: 2 }, offset: { x: 10, y: 0 } };
    // plane = world * 2 + 10, so world = (plane - 10) / 2.
    expect(coords(liveEditablePath('a', node, [], plane))).toEqual([-5, 0, 0, 0, 0, 5]);
  });
});

describe('storeEditablePath', () => {
  it('stores a world path back where the node keeps its polygon', () => {
    expect(storeEditablePath({ pose: tri(), data: { tag: 1 } }, tri(4))).toEqual({ pose: tri(4), data: { tag: 1 } });
    const node = { pose: { ...rect(100), rotation: Math.PI / 2 }, data: { path: tri(), tag: 1 } };
    const world = resolveEditablePathOf(node)!;
    const stored = storeEditablePath(node, world)!;
    expect((stored.data as { tag: number }).tag).toBe(1);
    expect((stored.pose as { rotation: number }).rotation).toBe(Math.PI / 2);
    const back = coords(resolveEditablePathOf(stored));
    coords(world).forEach((v, i) => expect(back[i]).toBeCloseTo(v, 4));
  });

  it('is null for a node with no polygon', () => {
    expect(storeEditablePath({ pose: rect(0), data: {} }, tri())).toBeNull();
  });
});

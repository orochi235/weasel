import { describe, expect, it } from 'vitest';
import { polygonFromPoints, rectPath, type PolygonPath } from '@weasel-js/geom';
import type { GesturePreviewSource } from 'canvas/gestureBounds';
import {
  classifyPathStorage, liveAnchorMarkers, liveEditablePath, pathEditPathOf, resolveEditablePathOf, storeEditablePath,
} from './editablePath';
import type { PathEditExtension } from './pathEditExtension';

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

describe('a rectangle path', () => {
  const node = { pose: { x: 100, y: 50, width: 20, height: 10 }, data: { path: rectPath(0, 0, 20, 10), tag: 1 } };

  it('is editable, with its four corners as anchors in world coords', () => {
    expect(classifyPathStorage(node)?.kind).toBe('data');
    expect(coords(resolveEditablePathOf(node))).toEqual([100, 50, 120, 50, 120, 60, 100, 60]);
  });

  it('follows a pose resized past the stored rect', () => {
    const resized = { ...node, pose: { x: 0, y: 0, width: 40, height: 40 } };
    expect(coords(resolveEditablePathOf(resized))).toEqual([0, 0, 40, 0, 40, 40, 0, 40]);
  });

  it('is stored as a polygon once edited, keeping the rest of its data', () => {
    const world = resolveEditablePathOf(node)!;
    const moved = new Float32Array(world.coords);
    moved[0] = 90;
    const stored = storeEditablePath(node, { ...world, coords: moved })!;
    const data = stored.data as { path: PolygonPath; tag: number };
    expect(data.path.kind).toBe('polygon');
    expect(data.tag).toBe(1);
    expect(stored.pose).toMatchObject({ x: 90, y: 50, width: 30, height: 10 });
    expect(coords(resolveEditablePathOf(stored))).toEqual([90, 50, 120, 50, 120, 60, 100, 60]);
  });

  it('is left a rect by reading it', () => {
    resolveEditablePathOf(node);
    expect(node.data.path.kind).toBe('rect');
  });
});

describe('a path drawn from a form', () => {
  // A form whose edit path is the drawn triangle's apex alone, and which draws an edit as the
  // triangle with its apex there.
  const apex = (path: PolygonPath) => polygonFromPoints([{ x: path.coords[4], y: path.coords[5] }]) as PolygonPath;
  const marker = () => tri();
  const extensions: PathEditExtension[] = [{
    id: 'apex',
    representation: {
      kind: 'apex',
      editPath: (path, form) => (form.valid ? apex(path) : null),
      store: (_path, form, edited) => (form.valid ? { path: tri(edited.coords[0]), form: { ...form, edits: 1 } } : null),
      anchorMarkers: () => [marker],
    },
  }];
  const node = { pose: tri(), data: { representation: { kind: 'apex', valid: true }, tag: 1 } };

  it('is edited through the form, by the representation that reads it', () => {
    expect(coords(pathEditPathOf(node, extensions))).toEqual([10, 10]);
    const stored = storeEditablePath(node, apex(tri(4)), extensions)!;
    expect(coords(stored.pose as PolygonPath)).toEqual(coords(tri(4)));
    expect(stored.data).toEqual({ representation: { kind: 'apex', valid: true, edits: 1 }, tag: 1 });
    expect(liveAnchorMarkers('a', node, [], extensions)).toEqual([marker]);
  });

  it('is edited as drawn, and loses the form, where no representation reads it or it no longer holds', () => {
    expect(pathEditPathOf(node)).toBe(node.pose);
    expect(storeEditablePath(node, tri(4))).toEqual({ pose: tri(4), data: { tag: 1 } });
    const stale = { ...node, data: { representation: { kind: 'apex', valid: false } } };
    expect(pathEditPathOf(stale, extensions)).toBe(stale.pose);
    expect(storeEditablePath(stale, tri(4), extensions)).toEqual({ pose: tri(4), data: {} });
    expect(liveAnchorMarkers('a', node, [], [])).toBeNull();
  });
});

describe('a leaf drawn as its rect pose alone', () => {
  const node = { kind: 'leaf', pose: { x: 100, y: 50, width: 20, height: 10 }, data: { tag: 1 } };

  it('reads as the rectangle it draws, changing nothing', () => {
    expect(classifyPathStorage(node)?.kind).toBe('data');
    expect(coords(resolveEditablePathOf(node))).toEqual([100, 50, 120, 50, 120, 60, 100, 60]);
    expect(coords(liveEditablePath('a', node, [], null))).toEqual([100, 50, 120, 50, 120, 60, 100, 60]);
    expect(node.data).toEqual({ tag: 1 });
  });

  it('gains a data.path on its first edit, keeping the rest of its data', () => {
    const world = resolveEditablePathOf(node)!;
    const moved = new Float32Array(world.coords);
    moved[0] = 90;
    const stored = storeEditablePath(node, { ...world, coords: moved })!;
    expect((stored.data as { tag: number }).tag).toBe(1);
    expect(coords(resolveEditablePathOf({ ...node, ...stored }))).toEqual([90, 50, 120, 50, 120, 60, 100, 60]);
  });

  it('is not a container, nor a leaf another painter draws', () => {
    expect(classifyPathStorage({ ...node, kind: 'container' })).toBeNull();
    expect(classifyPathStorage({ ...node, data: { text: 'hi' } })).toBeNull();
  });
});

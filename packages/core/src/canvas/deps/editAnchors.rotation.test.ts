import { describe, it, expect } from 'vitest';
import { resolveEditablePathOf } from './editAnchors';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from 'features/paths/types';
import { pathInWorld, worldEditToStorage } from 'features/paths/pathInWorld';

/** Unit square as a stored (origin-aligned) polygon path. */
const square = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
  fillRule: 'nonzero',
});

describe('resolveEditablePathOf — rotation', () => {
  it('bakes pose.rotation into the world anchors for a data.path node', () => {
    const node = { pose: { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 2 }, data: { path: square() } };
    const world = resolveEditablePathOf(node)!;
    // Center (5,5); corner (0,0) rotated 90° lands at (10,0).
    expect(world.coords[0]).toBeCloseTo(10);
    expect(world.coords[1]).toBeCloseTo(0);
  });

  it('returns the stored path unchanged when the pose has no rotation', () => {
    const node = { pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path: square() } };
    const world = resolveEditablePathOf(node)!;
    expect(Array.from(world.coords)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });
});

describe('worldEditToStorage — round-trip', () => {
  it('inverse-rotates a world edit back to an unrotated stored path, preserving rotation', () => {
    const pose = { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 2 };
    const world = resolveEditablePathOf({ pose, data: { path: square() } })!;

    const { pose: newPose, path: stored } = worldEditToStorage(pose, world);

    // rotation is preserved; stored path is unrotated (back to the origin square).
    expect((newPose as { rotation?: number }).rotation).toBeCloseTo(Math.PI / 2);
    const expected = [0, 0, 10, 0, 10, 10, 0, 10];
    for (let i = 0; i < expected.length; i++) expect(stored.coords[i]).toBeCloseTo(expected[i]);

    // Re-resolving the stored path + pose reproduces the committed world path.
    const world2 = pathInWorld(stored, newPose) as PolygonPath;
    for (let i = 0; i < world.coords.length; i++) expect(world2.coords[i]).toBeCloseTo(world.coords[i]);
  });
});

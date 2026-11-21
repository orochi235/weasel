import { describe, expect, it } from 'vitest';
import { affineImage, writeBounds } from './boxes2d';
import { createReachTree } from './reachTree';
import type { ReachSource } from './reachTypes';

/** A container `g` at the origin holding one child, painted again through `copy`. */
function copiedSource(copy: readonly [number, number, number, number, number, number]): ReachSource {
  const boxes: Record<string, [number, number, number, number]> = { g: [0, 0, 10, 10], c: [1e4, 1e4, 1e4 + 10, 1e4 + 10] };
  return {
    dim: 2,
    changesSince: () => ({ token: 0, ids: new Set(), parents: new Set(), structural: false }),
    childrenOf: (id) => (id === null ? ['g'] : id === 'g' ? ['c'] : []),
    parentOf: (id) => (id === 'g' ? null : id === 'c' ? 'g' : undefined),
    ownBox: (id, out, at) => {
      const [x0, y0, x1, y1] = boxes[id]!;
      return writeBounds({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, null, out, at);
    },
    tagsOf: () => 1,
    imagesOf: (id) => (id === 'g' ? [affineImage(copy)] : null),
  };
}

describe('a reach tree', () => {
  it('treats a copy that carries a child past every finite box as reaching everywhere', () => {
    const tree = createReachTree(copiedSource([1e305, 0, 0, 1e305, 0, 0]));
    tree.ensure();
    const far = { wanted: 1, regions: [{ box: [-5e5, -5e5, -5e5 + 10, -5e5 + 10] }] };
    expect(tree.childrenMeeting(null, ['g'], far)).toEqual(['g']);
  });

  it('still prunes a container whose copies stay finite and away from the view', () => {
    const tree = createReachTree(copiedSource([1, 0, 0, 1, 100, 0]));
    tree.ensure();
    const far = { wanted: 1, regions: [{ box: [-5e5, -5e5, -5e5 + 10, -5e5 + 10] }] };
    expect(tree.childrenMeeting(null, ['g'], far)).toEqual([]);
  });
});

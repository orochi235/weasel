import { describe, expect, it } from 'vitest';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseDescriptorForNode, type PoseDescriptor } from './poseDescriptor';

/**
 * Two shapes sharing one pose type: the descriptor can only tell them apart by
 * reading the node. A `box` occupies its pose; a `ball` occupies the box its
 * circumscribed circle sweeps, which is a different AABB for any non-square
 * pose.
 */
type RectPose = Bounds;
interface Solid {
  id: string;
  kind: 'box' | 'ball';
  pose: RectPose;
}

const ballBounds = (p: RectPose): Bounds => {
  const r = Math.max(p.width, p.height) / 2;
  return { x: p.x + p.width / 2 - r, y: p.y + p.height / 2 - r, width: 2 * r, height: 2 * r };
};

const SOLID_DESCRIPTOR: PoseDescriptor<RectPose, Solid> = {
  getBounds: (p) => p,
  remapBounds: (p) => p,
  fromBounds: (b) => ({ ...b }),
  forNode: (node) =>
    node.kind !== 'ball'
      ? SOLID_DESCRIPTOR
      : { ...SOLID_DESCRIPTOR, getBounds: ballBounds, forNode: undefined },
};

const WIDE: RectPose = { x: 0, y: 0, width: 40, height: 10 };

describe('PoseDescriptor.forNode', () => {
  it('returns the descriptor unchanged when it declares no node specialization', () => {
    const bare: PoseDescriptor<RectPose> = {
      getBounds: (p) => p,
      remapBounds: (p) => p,
      fromBounds: (b) => ({ ...b }),
    };
    expect(poseDescriptorForNode(bare, { id: 'x' })).toBe(bare);
  });

  it('reads different bounds for two nodes carrying the same pose', () => {
    const box: Solid = { id: 'box', kind: 'box', pose: WIDE };
    const ball: Solid = { id: 'ball', kind: 'ball', pose: WIDE };

    expect(poseDescriptorForNode(SOLID_DESCRIPTOR, box).getBounds(WIDE)).toEqual(WIDE);
    expect(poseDescriptorForNode(SOLID_DESCRIPTOR, ball).getBounds(WIDE)).toEqual({
      x: 0,
      y: -15,
      width: 40,
      height: 40,
    });
  });
});

describe('arrayAdapter hit-tests through the node-specialized descriptor', () => {
  function makeFixture() {
    const items: Solid[] = [
      { id: 'box', kind: 'box', pose: WIDE },
      { id: 'ball', kind: 'ball', pose: WIDE },
    ];
    const ref = { current: items };
    return arrayAdapter<Solid, RectPose>({
      ref,
      setItems: (updater) => {
        ref.current = updater(ref.current);
      },
      toPose: (o) => o.pose,
      fromPose: (o, pose) => ({ ...o, pose }),
      poseDescriptor: SOLID_DESCRIPTOR as PoseDescriptor<RectPose>,
    });
  }

  // A band above the shared pose: inside the ball's swept box, outside the
  // box's own. Only a descriptor that saw the node can separate them.
  const band = { x: 0, y: -14, width: 40, height: 5 };

  it('marquee picks the ball and not the box', () => {
    expect(makeFixture().hitTestArea!(band)).toEqual(['ball']);
  });

  it('lasso picks the ball and not the box', () => {
    const hits = makeFixture().hitTestLasso!(
      [
        { x: band.x, y: band.y },
        { x: band.x + band.width, y: band.y },
        { x: band.x + band.width, y: band.y + band.height },
        { x: band.x, y: band.y + band.height },
      ],
      'intersect',
    );
    expect(hits).toEqual(['ball']);
  });
});

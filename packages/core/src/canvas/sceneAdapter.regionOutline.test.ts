/**
 * `sceneToAdapter`'s marquee and lasso take a node by the outline it draws,
 * not by its bounding box.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { Node, NodeId } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { PATH_L, PATH_M, PATH_Z } from '@weasel-js/geom';
import { registerNodeShape } from './NodeShape';
import { sceneToAdapter } from './sceneAdapter';

/** Right triangle (0,0) → (100,0) → (0,100); its box's upper-right half is empty. */
const triangle = (dx: number, dy: number) => ({
  kind: 'polygon' as const,
  commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_Z),
  coords: Float32Array.of(dx, dy, dx + 100, dy, dx, dy + 100),
  fillRule: 'nonzero' as const,
});

function build() {
  const scene = createScene<unknown, string, unknown>({
    systemLayers: [{ id: 'default' }],
    initial: [
      // Polygon pose: the pose is the outline.
      { id: 'poly' as NodeId, kind: 'mark', layer: 'default', pose: triangle(0, 0), data: null },
      // Kit-drawn shape: geometry on `data.path` behind a rect pose.
      {
        id: 'drawn' as NodeId, kind: 'mark', layer: 'default',
        pose: { x: 200, y: 0, width: 100, height: 100 },
        data: { path: triangle(0, 0) },
      },
      // Rotated rect: its ink pokes out of its pose box.
      {
        id: 'turned' as NodeId, kind: 'mark', layer: 'default',
        pose: { x: 0, y: 200, width: 100, height: 20, rotation: Math.PI / 4 },
        data: null,
      },
    ],
  });
  return sceneToAdapter(scene);
}

const EMPTY_CORNER_OF_POLY = { x: 90, y: 90, width: 8, height: 8 };
const FILLED_CORNER_OF_POLY = { x: 0, y: 0, width: 8, height: 8 };
const EMPTY_CORNER_OF_DRAWN = { x: 290, y: 90, width: 8, height: 8 };
const FILLED_CORNER_OF_DRAWN = { x: 200, y: 0, width: 8, height: 8 };
const ROTATED_CORNER_OF_TURNED = { x: 15, y: 160, width: 15, height: 15 };
const EMPTY_PART_OF_TURNED_BOX = { x: 40, y: 170, width: 20, height: 15 };

describe('sceneToAdapter region hit-tests follow the drawn outline', () => {
  it('a marquee over the empty corner of a polygon pose takes nothing', () => {
    const adapter = build();
    expect(adapter.hitTestArea!(EMPTY_CORNER_OF_POLY)).toEqual([]);
    expect(adapter.hitTestArea!(FILLED_CORNER_OF_POLY)).toEqual(['poly']);
  });

  it('a marquee tests a kit-drawn shape by the path it paints', () => {
    const adapter = build();
    expect(adapter.hitTestArea!(EMPTY_CORNER_OF_DRAWN)).toEqual([]);
    expect(adapter.hitTestArea!(FILLED_CORNER_OF_DRAWN)).toEqual(['drawn']);
  });

  it('a marquee meets a rotated rect where it is drawn, not where its pose box sits', () => {
    const adapter = build();
    expect(adapter.hitTestArea!(ROTATED_CORNER_OF_TURNED)).toEqual(['turned']);
    expect(adapter.hitTestArea!(EMPTY_PART_OF_TURNED_BOX)).toEqual([]);
  });

  it('a lasso over the empty corner takes nothing', () => {
    const adapter = build();
    const corner = [{ x: 80, y: 80 }, { x: 99, y: 80 }, { x: 99, y: 99 }];
    expect(adapter.hitTestLasso!(corner, 'intersect')).toEqual([]);
  });

  it('an enclosing lasso takes a triangle whose box pokes out of it', () => {
    const adapter = build();
    // Hypotenuse x + y = 155: the triangle fits, its box corner (100,100) does not.
    const lasso = [{ x: -5, y: -5 }, { x: 160, y: -5 }, { x: -5, y: 160 }];
    expect(adapter.hitTestLasso!(lasso, 'enclosed')).toEqual(['poly']);
  });
});

/**
 * Two shapes sharing one pose type: a `box` occupies its pose, a `ball` the
 * box its circumscribed circle sweeps. Only a descriptor that saw the node
 * can tell them apart, and only a painter says what the ball draws there.
 */
describe('sceneToAdapter region hit-tests read the node-specialized descriptor', () => {
  type Solid = { kind: 'box' | 'ball' };
  type SolidNode = Node<Solid, string, Bounds>;

  const ballBounds = (p: Bounds): Bounds => {
    const r = Math.max(p.width, p.height) / 2;
    return { x: p.x + p.width / 2 - r, y: p.y + p.height / 2 - r, width: 2 * r, height: 2 * r };
  };
  const SOLID_DESCRIPTOR: PoseDescriptor<Bounds, SolidNode> = {
    getBounds: (p) => p,
    remapBounds: (p) => p,
    fromBounds: (b) => ({ ...b }),
    forNode: (node) =>
      node.data.kind !== 'ball'
        ? SOLID_DESCRIPTOR
        : { ...SOLID_DESCRIPTOR, getBounds: ballBounds, forNode: undefined },
  };
  const WIDE: Bounds = { x: 0, y: 0, width: 40, height: 10 };

  function solids() {
    const scene = createScene<Solid, string, Bounds>({
      systemLayers: [{ id: 'default' }],
      initial: [
        { id: 'box' as NodeId, kind: 'mark', layer: 'default', pose: WIDE, data: { kind: 'box' } },
        { id: 'ball' as NodeId, kind: 'mark', layer: 'default', pose: WIDE, data: { kind: 'ball' } },
      ],
    });
    return sceneToAdapter(scene, { poseDescriptor: SOLID_DESCRIPTOR as PoseDescriptor<Bounds> });
  }

  // Above the shared pose: inside the ball's swept box, outside the box's own.
  const band = { x: 0, y: -14, width: 40, height: 5 };
  const bandLasso = [{ x: 0, y: -14 }, { x: 40, y: -14 }, { x: 40, y: -9 }, { x: 0, y: -9 }];

  /** Paint the ball as the box its descriptor bounds it by. */
  const paintBall = (): (() => void) => registerNodeShape<Solid, Bounds>({
    id: 'test:ball',
    matches: (node) => node.data?.kind === 'ball',
    paint: () => [],
    silhouette: (_node, pose) => ({ kind: 'rect', ...ballBounds(pose) }),
  }, { priority: 'high' });

  it('marquee picks the ball and not the box', () => {
    const dispose = paintBall();
    try {
      expect(solids().hitTestArea!(band)).toEqual(['ball']);
      expect(solids().hitTestLasso!(bandLasso, 'intersect')).toEqual(['ball']);
    } finally {
      dispose();
    }
  });

  it('a marquee takes nothing where bounds reach but nothing is drawn, as a lasso does', () => {
    // No painter for the ball: it draws its pose rect, below the band.
    expect(solids().hitTestLasso!(bandLasso, 'intersect')).toEqual([]);
    expect(solids().hitTestArea!(band)).toEqual([]);
  });

  it('an enclosing lasso takes a node drawn inside it whose bounds poke out', () => {
    // Around the pose rect both draw; the ball's swept box reaches y = -15 and 25.
    const around = [{ x: -5, y: -5 }, { x: 45, y: -5 }, { x: 45, y: 15 }, { x: -5, y: 15 }];
    expect(solids().hitTestLasso!(around, 'enclosed')).toEqual(['box', 'ball']);
  });
});

/**
 * A pose override's `path`: what a node shows in place of the geometry in its data, with no
 * document write. The rig's skinning is the writer; these pin each reader.
 */
import { describe, expect, it, vi } from 'vitest';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { Node, RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { defaultDrawOne } from './defaultDrawOne';
import { sceneDerivedPathOf, withDerivedPaths } from './derivedPath';
import { findShapeSilhouette, shapeCoversPoint, type NodePaintCtx } from './NodeShape';
import { pickWalk, scenePickSource } from './pickWalk';

type Data = { path?: Path; fill?: string };

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const REST: RectPose = { x: 0, y: 0, width: 100, height: 20 };
/** The rest box bent upward at its middle: it reaches y = -80, well outside the rest pose. */
const BENT = polygonFromPoints([
  { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: -80 }, { x: 70, y: -80 }, { x: 70, y: 20 }, { x: 0, y: 20 },
]);
const BENT_POSE: RectPose = { x: 0, y: -80, width: 70, height: 100 };

function makeScene() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'leaf', layer: 'main', pose: REST,
    data: { path: { kind: 'rect', x: 0, y: 0, width: 100, height: 20 }, fill: '#f00' },
  });
  const plain = scene.add({
    kind: 'leaf', layer: 'main', pose: { x: 200, y: 0, width: 10, height: 10 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
  });
  return { scene, id, plain };
}

const paths = (cmds: readonly DrawCommand[]): Path[] => cmds.flatMap((c) =>
  c.kind === 'path' ? [c.path] : c.kind === 'group' ? paths(c.children) : []);

describe('a pose override path', () => {
  it('is folded into what the table reads', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    expect(scene.overrides.read(id)?.path).toBe(BENT);
    scene.overrides.clear(id);
    expect(scene.overrides.read(id)).toBeUndefined();
  });

  it('is the path the scene answers for the node', () => {
    const { scene, id, plain } = makeScene();
    const pathOf = sceneDerivedPathOf(scene);
    expect(pathOf(scene.get(id)!)).toBeNull();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    expect(pathOf(scene.get(id)!)).toBe(BENT);
    expect(pathOf(scene.get(plain)!)).toBeNull();
  });

  it('reaches the painter, and a node without one keeps the caller\'s ctx', () => {
    const { scene, id, plain } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    const drawOne = vi.fn((
      _n: Node<Data, 'main', RectPose>, _p: RectPose, _v: View, _ctx?: NodePaintCtx,
    ): DrawCommand[] => []);
    const wrapped = withDerivedPaths(scene, drawOne);
    const ctx: NodePaintCtx = {};
    wrapped(scene.get(id)!, BENT_POSE, VIEW, ctx);
    wrapped(scene.get(plain)!, scene.get(plain)!.pose, VIEW, ctx);
    expect(drawOne.mock.calls[0][3]?.derivedPath).toBe(BENT);
    expect(drawOne.mock.calls[1][3]).toBe(ctx);
  });

  it('is what kit:path paints, in place of the path in the node\'s data', () => {
    const { scene, id } = makeScene();
    const node = scene.get(id)!;
    expect(paths(defaultDrawOne(node, REST, VIEW))[0]).not.toBe(BENT);
    expect(paths(defaultDrawOne(node, BENT_POSE, VIEW, { derivedPath: BENT }))).toEqual([BENT]);
    // The memo is keyed on the node, pose, and data, none of which a second path changes.
    const other = polygonFromPoints([{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }]);
    expect(paths(defaultDrawOne(node, BENT_POSE, VIEW, { derivedPath: other }))).toEqual([other]);
    expect(paths(defaultDrawOne(node, BENT_POSE, VIEW))[0]).not.toBe(other);
  });

  it('is the silhouette, so a click lands on the bent shape and not on where it rested', () => {
    const { scene, id } = makeScene();
    const node = scene.get(id)!;
    expect(findShapeSilhouette(node, BENT_POSE, { derivedPath: BENT })).toBe(BENT);
    expect(shapeCoversPoint(node, BENT_POSE, 60, -60, { derivedPath: BENT })).toBe(true);
    expect(shapeCoversPoint(node, BENT_POSE, 90, 10, { derivedPath: BENT })).toBe(false);
  });

  it('is handed to the pick walk for a node that derives nothing', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    const src = scenePickSource(scene);
    expect(src.derivedPathOf?.(scene.get(id) as never)).toBe(BENT);
    const hit = (x: number, y: number) => pickWalk<RectPose>(src, {
      hits: (n, p) => shapeCoversPoint(n as never, p, x, y, { derivedPath: src.derivedPathOf?.(n) }),
      clipAdmits: () => true,
    });
    expect(hit(60, -60)).toEqual([id]);
    expect(hit(90, 10)).toEqual([]);
  });
});

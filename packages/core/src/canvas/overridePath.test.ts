/**
 * A pose override's `path`: what a node shows in place of the geometry in its data, with no
 * document write. The rig's skinning is the writer; these pin each reader.
 */
import { describe, expect, it, vi } from 'vitest';
import { boundsOfPath, polygonFromPoints, type Path } from '@weasel-js/geom';
import type { Fill } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { Node, RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { defaultDrawOne } from './defaultDrawOne';
import { sceneDepLookup, sceneDerivedPathOf, withDerivedPaths } from './derivedPath';
import { findShapeSilhouette, shapeCoversPoint, type NodePaintCtx } from './NodeShape';
import { pickWalk, scenePickSource } from './pickWalk';
import { wireSceneSlotToScene } from './sceneSlotWiring';

type Data = { path?: Path; fill?: Fill };

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
    data: { path: { kind: 'rect', x: 0, y: 0, width: 100, height: 20 }, fill: { paint: { color: '#f00' } } },
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

describe('a slot with its own toPose', () => {
  /** Paints every node 7 lower and twice as wide as it is handed it. */
  const stretched = (n: Node<Data, 'main', RectPose>): RectPose =>
    ({ ...n.pose, y: n.pose.y + 7, width: n.pose.width * 2 });
  const CARRIED = { x: 0, y: -73, width: 140, height: 100 };

  it('is handed the node at the pose an override shows it at', () => {
    const { scene, id, plain } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE });
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne, toPose: stretched }, scene);
    expect(slot.toPose!(scene.get(id)!)).toEqual(CARRIED);
    expect(slot.toPose!(scene.get(plain)!)).toEqual({ x: 200, y: 7, width: 20, height: 10 });
  });

  it('hands the stored node itself when nothing overrides it', () => {
    const { scene, plain } = makeScene();
    const toPose = vi.fn((n: Node<Data, 'main', RectPose>) => n.pose);
    wireSceneSlotToScene({ drawOne: defaultDrawOne, toPose }, scene).toPose!(scene.get(plain)!);
    expect(toPose.mock.calls[0][0]).toBe(scene.get(plain));
  });

  it('paints an override path carried into the box toPose answers', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    const drawOne = vi.fn((
      _n: Node<Data, 'main', RectPose>, _p: RectPose, _v: View, _ctx?: NodePaintCtx,
    ): DrawCommand[] => []);
    const slot = wireSceneSlotToScene({ drawOne, toPose: stretched }, scene);
    const node = scene.get(id)!;
    slot.drawOne(node, slot.toPose!(node), VIEW);
    expect(boundsOfPath(drawOne.mock.calls[0][3]!.derivedPath!)).toMatchObject(CARRIED);
    expect(boundsOfPath(slot.derivedPathOf!(node, slot.toPose!(node))!)).toMatchObject(CARRIED);
  });

  it('answers the override path itself when toPose leaves the box alone', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    const same = (n: Node<Data, 'main', RectPose>): RectPose => ({ ...n.pose });
    expect(sceneDerivedPathOf(scene, same)(scene.get(id)!)).toBe(BENT);
  });

  // The walk turns what the painter draws by the pose it paints at, so the path stays in the
  // unturned box: carried through the turn as well, it would be turned twice.
  it('carries an override path box to box when toPose also turns the node', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    const turned = (n: Node<Data, 'main', RectPose>): RectPose => ({ ...stretched(n), rotation: Math.PI / 2 });
    const drawOne = vi.fn((
      _n: Node<Data, 'main', RectPose>, _p: RectPose, _v: View, _ctx?: NodePaintCtx,
    ): DrawCommand[] => []);
    const slot = wireSceneSlotToScene({ drawOne, toPose: turned }, scene);
    const node = scene.get(id)!;
    slot.drawOne(node, slot.toPose!(node), VIEW);
    const b = boundsOfPath(drawOne.mock.calls[0][3]!.derivedPath!);
    expect([b.x, b.y, b.width, b.height].map(Math.round)).toEqual([CARRIED.x, CARRIED.y, CARRIED.width, CARRIED.height]);
    const onlyTurned = (n: Node<Data, 'main', RectPose>): RectPose => ({ ...n.pose, rotation: Math.PI / 2 });
    expect(sceneDerivedPathOf(scene, onlyTurned)(node)).toBe(BENT);
  });

  it('answers the carried path as a dependency\'s path', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: BENT_POSE, path: BENT });
    const dep = sceneDepLookup(scene, stretched)(id)!;
    expect(dep.pose).toEqual(CARRIED);
    expect(boundsOfPath(dep.path!)).toMatchObject(CARRIED);
  });
});

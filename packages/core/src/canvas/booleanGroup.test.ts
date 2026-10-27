/**
 * A boolean group draws, and is picked by, the boolean of its children's
 * outlines; its children are reached only from inside it.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathContainsPoint, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import { booleanGroupFields } from 'core/scene/booleanGroup';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { createEnteredGroup, reachableInGroup } from './deps/enteredGroup';
import { sceneDerivedPathOf } from './derivedPath';
import { defaultDrawOne } from './defaultDrawOne';
import { buildSceneViewCommands } from './sceneViewRender';
import { pickWalk, scenePickSource } from './pickWalk';
import { scenePointQuery } from './SceneCanvas/scenePointQuery';
import type { View } from 'core/viewport/view';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { translateEach } from 'interactions/actions/selectionSubtree';
import { createEnterGroupAction } from 'interactions/actions/defaults/enterGroup';

type Data = { shape?: string; fill?: unknown; boolean?: string };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const RED = { paint: { kind: 'solid', color: '#ff0000' } };
const box = (x: number, y: number, width = 100, height = 100): RectPose => ({ x, y, width, height });

/** A boolean group over a back square at (0, 0) and a front one at (50, 50), both 100 wide. */
function makeScene(op?: string) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({
    ...booleanGroupFields<RectPose>(), layer: 'main', pose: box(0, 0, 0, 0),
    data: { fill: RED, ...(op ? { boolean: op } : {}) },
  });
  const back = scene.add({ kind: 'mark', layer: 'main', parent: group, pose: box(0, 0), data: { shape: 'rect', fill: RED } });
  const front = scene.add({ kind: 'mark', layer: 'main', parent: group, pose: box(50, 50), data: { shape: 'rect', fill: RED } });
  return { scene, group, back, front };
}

const pathOf = (scene: Scene<Data, 'main', RectPose>, id: NodeId): Path | null =>
  sceneDerivedPathOf(scene)(scene.get(id)!);

const covers = (path: Path | null, x: number, y: number) => path !== null && pathContainsPoint(path, x, y);

function paths(cmds: readonly DrawCommand[]): Path[] {
  const out: Path[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push((cmd as { path: Path }).path);
    else if (cmd.kind === 'group') out.push(...paths(cmd.children));
  }
  return out;
}

function pickAt(scene: Scene<Data, 'main', RectPose>, x: number, y: number): string[] {
  const query = scenePointQuery<RectPose>(AUTO_POSE_DESCRIPTOR, true, 0)(x, y, { x: 1, y: 1 });
  return pickWalk(scenePickSource(scene), query);
}

describe('a boolean group', () => {
  it('derives each operation from its children, back to front', () => {
    const at = (op: string) => {
      const { scene, group } = makeScene(op);
      const p = pathOf(scene, group);
      return [covers(p, 25, 25), covers(p, 75, 75), covers(p, 125, 125)];
    };
    expect(at('union')).toEqual([true, true, true]);
    expect(at('subtract')).toEqual([true, false, false]);
    expect(at('intersect')).toEqual([false, true, false]);
    expect(at('exclude')).toEqual([true, false, true]);
  });

  it('is a union when its data names no operation', () => {
    const { scene, group } = makeScene();
    expect(boundsOfPath(pathOf(scene, group)!)).toMatchObject({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('recomputes when a child moves, its operation changes, or a child is hidden', () => {
    const { scene, group, front } = makeScene('subtract');
    expect(covers(pathOf(scene, group), 75, 75)).toBe(false);
    scene.setPose(front, box(200, 200));
    expect(covers(pathOf(scene, group), 75, 75)).toBe(true);
    scene.update(group, { data: { fill: RED, boolean: 'union' } });
    expect(covers(pathOf(scene, group), 250, 250)).toBe(true);
    scene.setHidden(front, true);
    expect(covers(pathOf(scene, group), 250, 250)).toBe(false);
  });

  it('follows a turned child', () => {
    const { scene, group, front } = makeScene('union');
    scene.setPose(front, { ...box(200, 0), rotation: Math.PI / 4 });
    // The diamond's corner reaches past its unturned box.
    expect(covers(pathOf(scene, group), 250, -15)).toBe(true);
    expect(covers(pathOf(scene, group), 205, 5)).toBe(false);
  });

  it('takes a nested boolean group as one operand', () => {
    const { scene, group, back, front } = makeScene('subtract');
    const inner = scene.add({ ...booleanGroupFields<RectPose>(), layer: 'main', parent: group, pose: box(0, 0, 0, 0), data: { boolean: 'union' } });
    scene.move(front, inner);
    scene.add({ kind: 'mark', layer: 'main', parent: inner, pose: box(0, 0, 20, 20), data: { shape: 'rect' } });
    const p = pathOf(scene, group);
    expect(covers(p, 10, 10)).toBe(false);
    expect(covers(p, 75, 75)).toBe(false);
    expect(covers(p, 40, 10)).toBe(true);
    expect(scene.get(back)).toBeDefined();
  });

  it('draws its result in its own paint and none of its children', () => {
    const { scene, group } = makeScene('subtract');
    const drawn = paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne));
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toBe(pathOf(scene, group));
  });

  it('is picked on its result and not where an operand took shape away', () => {
    const { scene, group } = makeScene('subtract');
    expect(pickAt(scene, 25, 25)).toContain(group);
    expect(pickAt(scene, 75, 75)).not.toContain(group);
  });

  it('keeps its children out of reach until it is entered', () => {
    const { scene, group, back } = makeScene();
    expect(reachableInGroup(scene, null, group)).toBe(true);
    expect(reachableInGroup(scene, null, back)).toBe(false);
    const entered = createEnteredGroup(scene);
    entered.enter(group);
    expect(entered.get()).toBe(group);
    expect(reachableInGroup(scene, entered.get(), back)).toBe(true);
    expect(reachableInGroup(scene, entered.get(), group)).toBe(false);
  });

  it('keeps the children of a boolean group nested in an entered one out of reach', () => {
    const { scene, group, front } = makeScene();
    const inner = scene.add({ ...booleanGroupFields<RectPose>(), layer: 'main', parent: group, pose: box(0, 0, 0, 0), data: {} });
    scene.move(front, inner);
    expect(reachableInGroup(scene, group, inner)).toBe(true);
    expect(reachableInGroup(scene, group, front)).toBe(false);
    expect(reachableInGroup(scene, inner, front)).toBe(true);
  });

  it('moves with its children when it is moved', () => {
    const { scene, group } = makeScene('subtract');
    scene.batch('move', () => translateEach(
      scene as never, scenePoseFrame(scene as never), AUTO_POSE_DESCRIPTOR, [{ id: group, dx: 300, dy: 0 }],
    ));
    expect(covers(pathOf(scene, group), 325, 25)).toBe(true);
    expect(covers(pathOf(scene, group), 25, 25)).toBe(false);
  });

  it('is entered by a double-click on it', () => {
    const { scene, group } = makeScene();
    const entered = createEnteredGroup(scene);
    const action = createEnterGroupAction({
      pickHit: () => group,
      tree: { getParent: (id) => scene.get(asNodeId(id))?.parent ?? null, getNode: (id) => scene.get(asNodeId(id)) },
    });
    const run = action.invoker as { run: (deps: unknown, params: unknown) => void };
    run.run({ enteredGroup: entered }, { world: { x: 25, y: 25 } });
    expect(entered.get()).toBe(group);
  });

  it('round-trips through a save', () => {
    const { scene, group } = makeScene('intersect');
    const json = scene.toJSON();
    expect(json.nodes.find((n) => n.id === group)).toMatchObject({ consumesChildren: true, derivePathKey: 'kit:booleanOfChildren' });
    const loaded = sceneFromJSON<Data, 'main', RectPose>(json);
    const node = loaded.get(asNodeId(group))!;
    expect(node.consumesChildren).toBe(true);
    expect(covers(pathOf(loaded, group), 75, 75)).toBe(true);
    expect(covers(pathOf(loaded, group), 25, 25)).toBe(false);
  });
});

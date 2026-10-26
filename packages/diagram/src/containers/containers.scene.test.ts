import { describe, expect, it } from 'vitest';
import {
  commitOps, createScene, editPreset, moveAction, resizeAction, sceneFromJSON, type ActionDeps, type InvocationCtx, type NodeId, type OngoingHandle,
  type OngoingInvoker, type RectPose,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { waypointFollower } from '../waypointFollower';
import { diagramCanDropInto } from './canDropInto';
import { CONTAINER_STENCILS, addLane, containerBuild, lanesOf, releaseMembers } from './containerStencils';
import { titleIdOf } from './trait';

type Scene = ReturnType<typeof makeScene>;

function makeScene() {
  return createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
}

const stencil = (id: string) => CONTAINER_STENCILS.find((s) => s.id === id)!;

function build(scene: Scene, id: string, at: RectPose): string {
  let n = 0;
  const built = containerBuild(stencil(id), at, { layer: 'main', newId: () => `${id}${n++ === 0 ? '' : `-${n - 1}`}` });
  commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
  return built.id;
}

function shape(scene: Scene, id: string, at: RectPose, parent?: string): void {
  scene.add({
    id: id as NodeId, kind: 'mark', layer: 'main', pose: at, data: { diagram: { outline: 'rect' } },
    ...(parent ? { parent: parent as NodeId } : {}),
  });
}

function edge(scene: Scene, id: string, from: string, to: string, waypoints: Vec2[]): void {
  scene.add({
    id: id as NodeId, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: {}, to: {}, waypoints } }, dependsOn: [from as NodeId, to as NodeId], derivePath: EDGE_DERIVE_PATH as never,
  });
}

const pose = (scene: Scene, id: string) => scene.get(id as NodeId)!.pose;
const parentOf = (scene: Scene, id: string) => scene.get(id as NodeId)?.parent ?? null;

function drag(scene: Scene, ids: string[], from: Vec2, to: Vec2): OngoingHandle {
  const deps = {
    selection: { get: () => ids, adapterMethods: undefined },
    scene,
    layout: { getLayout: (id: string) => scene.layoutOf(id as NodeId) },
    canDropInto: diagramCanDropInto(scene),
    transformFollowers: [waypointFollower(scene)],
  } as unknown as ActionDeps;
  const at = (p: Vec2, moving: boolean) => ({
    world: p, screen: p, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
    drag: moving ? { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y } } : undefined,
  }) as unknown as InvocationCtx;
  const handle = (moveAction.invoker as OngoingInvoker).start(at(from, false)) as OngoingHandle;
  handle.onMove!(at(to, true));
  handle.onEnd!(at(to, true), 'commit');
  return handle;
}

describe('containers in a scene', () => {
  it('takes a shape dragged into its body as a member, in the move\'s one entry', () => {
    const scene = makeScene();
    build(scene, 'container', { x: 100, y: 100, width: 240, height: 160 });
    shape(scene, 's', { x: 0, y: 0, width: 40, height: 20 });
    const entries = scene.historyIndex();
    drag(scene, ['s'], { x: 20, y: 10 }, { x: 200, y: 200 });
    expect(parentOf(scene, 's')).toBe('container');
    expect(pose(scene, 's')).toMatchObject({ x: 180, y: 190 });
    expect(scene.historyIndex()).toBe(entries + 1);
    scene.undo();
    expect(parentOf(scene, 's')).toBe(null);
  });

  it('does not take a shape dropped on its header', () => {
    const scene = makeScene();
    build(scene, 'container', { x: 100, y: 100, width: 240, height: 160 });
    shape(scene, 's', { x: 0, y: 0, width: 40, height: 20 });
    drag(scene, ['s'], { x: 20, y: 10 }, { x: 200, y: 110 });
    expect(parentOf(scene, 's')).toBe(null);
  });

  it('releases a member dragged out of it', () => {
    const scene = makeScene();
    build(scene, 'container', { x: 100, y: 100, width: 240, height: 160 });
    shape(scene, 's', { x: 150, y: 150, width: 40, height: 20 }, 'container');
    drag(scene, ['s'], { x: 160, y: 160 }, { x: 600, y: 600 });
    expect(parentOf(scene, 's')).toBe(null);
    expect(pose(scene, 's')).toMatchObject({ x: 590, y: 590 });
  });

  it('carries its members, its title, and their connectors\' waypoints when it moves', () => {
    const scene = makeScene();
    build(scene, 'container', { x: 100, y: 100, width: 240, height: 160 });
    shape(scene, 'a', { x: 120, y: 150, width: 40, height: 20 }, 'container');
    shape(scene, 'b', { x: 260, y: 200, width: 40, height: 20 }, 'container');
    edge(scene, 'ab', 'a', 'b', [{ x: 200, y: 160 }]);
    const title = pose(scene, titleIdOf('container'));
    drag(scene, ['container'], { x: 110, y: 110 }, { x: 160, y: 140 });
    expect(pose(scene, 'a')).toMatchObject({ x: 170, y: 180 });
    expect(pose(scene, titleIdOf('container'))).toMatchObject({ x: title.x + 50, y: title.y + 30 });
    expect((scene.get('ab' as NodeId)!.data.diagram as DiagramEdge).waypoints).toEqual([{ x: 250, y: 190 }]);
  });

  it('leaves its members where they are when it is resized', () => {
    const scene = makeScene();
    const id = build(scene, 'container', { x: 100, y: 100, width: 240, height: 160 });
    shape(scene, 's', { x: 150, y: 150, width: 40, height: 20 }, id);
    const deps = { selection: { get: () => [id] }, scene } as unknown as ActionDeps;
    const ctx = (current: Vec2) => ({
      world: current, screen: current, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
      drag: {
        start: { x: 100, y: 100 }, current, delta: { x: current.x - 100, y: current.y - 100 },
        affordance: { kind: 'handle:top-left', targetIds: [id], anchor: { x: 'max', y: 'max' } },
      },
    }) as unknown as InvocationCtx;
    const handle = (resizeAction.invoker as OngoingInvoker).start(ctx({ x: 100, y: 100 }), undefined) as OngoingHandle;
    handle.onMove!(ctx({ x: 40, y: 60 }));
    handle.onEnd!(ctx({ x: 40, y: 60 }), 'commit');
    expect(pose(scene, id)).toMatchObject({ x: 40, y: 60, width: 300, height: 200 });
    expect(pose(scene, 's')).toEqual({ x: 150, y: 150, width: 40, height: 20 });
    expect(pose(scene, titleIdOf(id))).toMatchObject({ x: 40, y: 60, width: 300 });
  });

  it('takes its members when deleted, and keeps them on release, in one entry each', () => {
    const scene = makeScene();
    build(scene, 'container', { x: 100, y: 100, width: 240, height: 160 });
    shape(scene, 's', { x: 150, y: 150, width: 40, height: 20 }, 'container');
    scene.remove('container' as NodeId);
    expect(scene.get('s' as NodeId)).toBeUndefined();
    scene.undo();
    const entries = scene.historyIndex();
    releaseMembers(scene as never, 'container');
    expect(scene.get('container' as NodeId)).toBeUndefined();
    expect(scene.get(titleIdOf('container') as NodeId)).toBeUndefined();
    expect(parentOf(scene, 's')).toBe(null);
    expect(pose(scene, 's')).toEqual({ x: 150, y: 150, width: 40, height: 20 });
    expect(scene.historyIndex()).toBe(entries + 1);
  });
});

describe('pools in a scene', () => {
  const lanePoses = (scene: Scene, pool: string) => lanesOf(scene as never, pool).map((id) => pose(scene, id));

  it('start with two lanes stacked along the pool, past its header', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    expect(lanePoses(scene, pool)).toEqual([
      { x: 32, y: 0, width: 448, height: 120 },
      { x: 32, y: 120, width: 448, height: 120 },
    ]);
  });

  it('take a shape dropped in a lane as that lane\'s member, and refuse one dropped on the pool', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [, second] = lanesOf(scene as never, pool);
    shape(scene, 's', { x: 600, y: 0, width: 40, height: 20 });
    drag(scene, ['s'], { x: 610, y: 10 }, { x: 300, y: 180 });
    expect(parentOf(scene, 's')).toBe(second);
    shape(scene, 't', { x: 600, y: 0, width: 40, height: 20 });
    drag(scene, ['t'], { x: 610, y: 10 }, { x: 10, y: 100 });
    expect(parentOf(scene, 't')).toBe(null);
  });

  it('grow by a lane added at the end, in one entry', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const entries = scene.historyIndex();
    const lane = addLane(scene as never, pool)!;
    expect(lanesOf(scene as never, pool).at(-1)).toBe(lane);
    expect(pose(scene, lane)).toEqual({ x: 32, y: 240, width: 448, height: 120 });
    expect(pose(scene, pool)).toMatchObject({ height: 360 });
    expect(scene.historyIndex()).toBe(entries + 1);
  });

  it('move a later lane\'s members when a lane goes in before it', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [, second] = lanesOf(scene as never, pool);
    shape(scene, 's', { x: 100, y: 150, width: 40, height: 20 }, second);
    addLane(scene as never, pool, 1);
    expect(lanesOf(scene as never, pool)[2]).toBe(second);
    expect(pose(scene, second!)).toMatchObject({ y: 240 });
    expect(pose(scene, 's')).toMatchObject({ x: 100, y: 270 });
  });

  it('put a lane nudged out of its stack back in it, members and all, in the nudge\'s entry', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [first] = lanesOf(scene as never, pool);
    shape(scene, 's', { x: 100, y: 30, width: 40, height: 20 }, first);
    const entries = scene.historyIndex();
    const nudge = editPreset.actions!.find((a) => a.id === 'nudge.down')!.invoker as { run: (d: never, p?: never) => void };
    nudge.run({ scene, selection: { get: () => [first!] } } as never, { magnitude: 'large' } as never);
    expect(pose(scene, first!)).toEqual({ x: 32, y: 0, width: 448, height: 120 });
    expect(pose(scene, 's')).toMatchObject({ y: 30 });
    expect(scene.historyIndex()).toBe(entries + 1);
  });

  it('reorder lanes dragged by the header, members and all', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [first, second] = lanesOf(scene as never, pool);
    shape(scene, 's', { x: 100, y: 30, width: 40, height: 20 }, first);
    shape(scene, 't', { x: 100, y: 150, width: 40, height: 20 }, second);
    drag(scene, [second!], { x: 40, y: 180 }, { x: 40, y: 20 });
    expect(lanesOf(scene as never, pool)).toEqual([second, first]);
    expect(pose(scene, 't')).toMatchObject({ y: 30 });
    expect(pose(scene, 's')).toMatchObject({ y: 150 });
  });

  it('release every lane\'s members when released', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [first] = lanesOf(scene as never, pool);
    shape(scene, 's', { x: 100, y: 30, width: 40, height: 20 }, first);
    releaseMembers(scene as never, pool);
    expect(scene.get(pool as NodeId)).toBeUndefined();
    expect(parentOf(scene, 's')).toBe(null);
  });

  it('round-trip through toJSON with their layouts', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const back = sceneFromJSON(JSON.parse(JSON.stringify(scene.toJSON())), { registry: withDiagramRegistry() });
    expect(back.layoutOf(pool as NodeId)).toBe(scene.layoutOf(pool as NodeId));
  });
});

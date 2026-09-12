import { describe, expect, it } from 'vitest';
import { moveAction, type GesturePreviewSource, type InvocationCtx, type NodeId } from '@weasel-js/core';
import { createCamera } from './camera3d';
import { createPoseDescriptor } from './deps3d';
import { collectGhosts } from './ghosts3d';
import { createSolidScene, pose3, type SolidScene } from './scene3d';

function firstId(scene: SolidScene) {
  return scene.renderOrderNodes()[0].id;
}

function source(poses: Record<string, unknown>): GesturePreviewSource {
  return {
    previewIds: () => Object.keys(poses),
    previewPose: (id) => poses[id] ?? null,
  };
}

describe('collectGhosts', () => {
  it('is empty when nothing is in flight', () => {
    expect(collectGhosts([], createSolidScene())).toEqual([]);
  });

  it('takes the pose from the handle and the appearance from the scene', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const node = scene.get(id)!;
    const moved = pose3([5, 0.5, -3]);

    const ghosts = collectGhosts([source({ [id]: moved })], scene);

    expect(ghosts).toEqual([{ id, pose: moved, kind: node.data.kind, color: node.data.color }]);
  });

  it('leaves the document pose alone', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const before = scene.get(id)!.pose;

    collectGhosts([source({ [id]: pose3([5, 0.5, -3]) })], scene);

    expect(scene.get(id)!.pose).toBe(before);
  });

  it('skips ids with no node — an insert previews before it has one', () => {
    const scene = createSolidScene();
    expect(collectGhosts([source({ 'not-a-node': pose3([0, 0, 0]) })], scene)).toEqual([]);
  });

  it('skips an id the source declares but has no pose for', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const handle: GesturePreviewSource = {
      previewIds: () => [id],
      previewPose: () => null,
    };
    expect(collectGhosts([handle], scene)).toEqual([]);
  });

  it('merges sources first-non-null, the way the kit ghost layer does', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const winner = pose3([1, 0.5, 1]);
    const loser = pose3([9, 0.5, 9]);

    const ghosts = collectGhosts([source({ [id]: winner }), source({ [id]: loser })], scene);

    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].pose).toBe(winner);
  });

  it('ignores a source that previews nothing', () => {
    const scene = createSolidScene();
    expect(collectGhosts([{}, { previewIds: () => null }], scene)).toEqual([]);
  });

  /**
   * `previewPose` is typed `unknown` — the kit is generic over the pose and
   * casts. A pose from some other descriptor would reach the renderer as NaN
   * matrices rather than as an error, so it is dropped here instead.
   */
  it('drops a pose that is not a Pose3', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const flat = { x: 1, y: 2, width: 3, height: 4 };
    expect(collectGhosts([source({ [id]: flat })], scene)).toEqual([]);
  });
});

/**
 * Against the real action rather than a stand-in: the pose a ghost carries is
 * whatever `moveAction` puts on its handle, and that arrives as `unknown`.
 */
describe('a ghost off a live move handle', () => {
  const viewport = () => ({
    camera: createCamera({ distance: 14, pitch: 0.45, yaw: 0.6, target: [0, 0.5, 0] as const }),
    width: 800,
    height: 600,
  });

  function startDrag(scene: SolidScene, id: NodeId) {
    const selection = { get: () => [id], set: () => {} };
    const deps = {
      selection,
      scene,
      poseDescriptor: createPoseDescriptor(viewport as never),
    } as unknown as InvocationCtx['deps'];

    const ctx = {
      world: { x: 400, y: 300 },
      screen: { x: 400, y: 300 },
      modifiers: { shift: false, meta: false, ctrl: false, alt: false },
      deps,
      drag: {
        start: { x: 400, y: 300 },
        current: { x: 400, y: 300 },
        delta: { x: 0, y: 0 },
      },
    } as unknown as InvocationCtx;

    const invoker = moveAction.invoker as {
      start(ctx: InvocationCtx): GesturePreviewSource & { onMove?(ctx: InvocationCtx): void };
    };
    const handle = invoker.start(ctx);

    handle.onMove?.({
      ...ctx,
      drag: {
        start: { x: 400, y: 300 },
        current: { x: 520, y: 330 },
        delta: { x: 120, y: 30 },
      },
    } as unknown as InvocationCtx);

    return handle;
  }

  it('ghosts the dragged solid without touching the document', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const before = scene.get(id)!.pose;

    const ghosts = collectGhosts([startDrag(scene, id)], scene);

    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].id).toBe(id);
    expect(scene.get(id)!.pose).toBe(before);
  });

  it('moves the ghost along the ground plane, not through it', () => {
    const scene = createSolidScene();
    const id = firstId(scene);
    const before = scene.get(id)!.pose;

    const [ghost] = collectGhosts([startDrag(scene, id)], scene);

    expect(ghost.pose.position[0]).not.toBeCloseTo(before.position[0], 3);
    expect(ghost.pose.position[1]).toBeCloseTo(before.position[1], 6);
  });
});

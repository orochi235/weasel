import { describe, expect, it } from 'vitest';
import {
  createPoseFeed,
  moveAction,
  type GesturePreviewSource,
  type InvocationCtx,
  type NodeId,
} from '@weasel-js/core';
import { createCamera, createPoseDescriptor } from '@weasel-js/kernel3d';
import { applyFeedDelta, solidsToDraw, type SolidRecord } from './draws3d';
import { aabbOfSolid, createSolidScene, pose3, type SolidScene } from './scene3d';

function firstId(scene: SolidScene) {
  return scene.renderOrderNodes()[0].id;
}

/** The lab's own loop: read the feed, patch the records, build the frame. */
function frameOf(scene: SolidScene, draws: Map<NodeId, SolidRecord>, feed = createPoseFeed(scene)) {
  applyFeedDelta(draws, feed.read());
  return solidsToDraw(draws, new Set<NodeId>());
}

describe('applyFeedDelta', () => {
  it('takes a record per node from the first read', () => {
    const scene = createSolidScene();
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, createPoseFeed(scene).read());

    expect(draws.size).toBe(scene.renderOrderNodes().length);
    const node = scene.get(firstId(scene))!;
    expect(draws.get(node.id)).toEqual({
      committed: node.pose,
      pose: node.pose,
      kind: node.data.kind,
      color: node.data.color,
    });
  });

  it('holds one pose object while nothing overrides it', () => {
    const scene = createSolidScene();
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, createPoseFeed(scene).read());
    const record = draws.get(firstId(scene))!;

    expect(record.pose).toBe(record.committed);
  });

  it('drops a removed node and keeps the rest', () => {
    const scene = createSolidScene();
    const feed = createPoseFeed(scene);
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, feed.read());
    const id = firstId(scene);

    scene.remove(id);
    applyFeedDelta(draws, feed.read());

    expect(draws.has(id)).toBe(false);
    expect(draws.size).toBe(scene.renderOrderNodes().length);
  });

  it('rebuilds from empty on a reset', () => {
    const scene = createSolidScene();
    const draws = new Map<NodeId, SolidRecord>([
      ['stale' as NodeId, { committed: pose3({ x: 0, y: 0, z: 0 }), pose: pose3({ x: 0, y: 0, z: 0 }), kind: 'box', color: '#fff' }],
    ]);
    applyFeedDelta(draws, createPoseFeed(scene).read());

    expect(draws.has('stale' as NodeId)).toBe(false);
  });
});

describe('solidsToDraw', () => {
  it('draws every solid once when nothing is in flight', () => {
    const scene = createSolidScene();
    const solids = frameOf(scene, new Map());

    expect(solids).toHaveLength(scene.renderOrderNodes().length);
    expect(solids.some((s) => s.ghost)).toBe(false);
  });

  it('marks the selected solids and nothing else', () => {
    const scene = createSolidScene();
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, createPoseFeed(scene).read());
    const id = firstId(scene);

    const solids = solidsToDraw(draws, new Set([id]));

    expect(solids.filter((s) => s.selected)).toHaveLength(1);
  });

  it('keeps the solid at its committed pose and ghosts the override', () => {
    const scene = createSolidScene();
    const feed = createPoseFeed(scene);
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, feed.read());

    const id = firstId(scene);
    const committed = scene.get(id)!.pose;
    const moved = pose3({ x: 5, y: 0.5, z: -3 });
    scene.overrides.set(id, { pose: moved });
    scene.overrides.commit();
    applyFeedDelta(draws, feed.read());

    const solids = solidsToDraw(draws, new Set<NodeId>());
    const ghosts = solids.filter((s) => s.ghost);

    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].pose).toBe(moved);
    expect(solids.find((s) => !s.ghost && s.pose === committed)).toBeDefined();
  });

  it('stops ghosting when the override clears', () => {
    const scene = createSolidScene();
    const feed = createPoseFeed(scene);
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, feed.read());

    const id = firstId(scene);
    scene.overrides.set(id, { pose: pose3({ x: 5, y: 0.5, z: -3 }) });
    scene.overrides.commit();
    applyFeedDelta(draws, feed.read());
    scene.overrides.clearAll();
    applyFeedDelta(draws, feed.read());

    expect(solidsToDraw(draws, new Set<NodeId>()).some((s) => s.ghost)).toBe(false);
  });

  it('draws every ghost above every solid', () => {
    const scene = createSolidScene();
    const feed = createPoseFeed(scene);
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, feed.read());

    scene.overrides.set(firstId(scene), { pose: pose3({ x: 5, y: 0.5, z: -3 }) });
    scene.overrides.commit();
    applyFeedDelta(draws, feed.read());

    const solids = solidsToDraw(draws, new Set<NodeId>());
    expect(solids.findIndex((s) => s.ghost)).toBe(solids.length - 1);
  });
});

/**
 * Against the real action rather than a stand-in: what reaches the feed is
 * whatever `moveAction` publishes as an override, and the lab's picture of a
 * drag is only right if the document pose stays put underneath it.
 */
describe('a frame drawn mid-drag', () => {
  const viewport = () => ({
    camera: createCamera({ distance: 14, pitch: 0.45, yaw: 0.6, target: { x: 0, y: 0.5, z: 0 } }),
    width: 800,
    height: 600,
  });

  function startDrag(scene: SolidScene, id: NodeId) {
    const selection = { get: () => [id], set: () => {} };
    const deps = {
      selection,
      scene,
      poseDescriptor: createPoseDescriptor({
        scene,
        viewport,
        bounds: (node) => aabbOfSolid(node.pose, node.data.kind),
      }),
    } as unknown as InvocationCtx['deps'];

    const ctx = {
      world: { x: 400, y: 300 },
      screen: { x: 400, y: 300 },
      modifiers: { shift: false, meta: false, ctrl: false, alt: false },
      deps,
      drag: { start: { x: 400, y: 300 }, current: { x: 400, y: 300 }, delta: { x: 0, y: 0 } },
    } as unknown as InvocationCtx;

    const invoker = moveAction.invoker as {
      start(ctx: InvocationCtx): GesturePreviewSource & { onMove?(ctx: InvocationCtx): void };
    };
    const handle = invoker.start(ctx);

    handle.onMove?.({
      ...ctx,
      drag: { start: { x: 400, y: 300 }, current: { x: 520, y: 330 }, delta: { x: 120, y: 30 } },
    } as unknown as InvocationCtx);

    return handle;
  }

  it('ghosts the dragged solid without touching the document', () => {
    const scene = createSolidScene();
    const feed = createPoseFeed(scene);
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, feed.read());

    const id = firstId(scene);
    const before = scene.get(id)!.pose;
    startDrag(scene, id);
    applyFeedDelta(draws, feed.read());

    const ghosts = solidsToDraw(draws, new Set<NodeId>()).filter((s) => s.ghost);
    expect(ghosts).toHaveLength(1);
    expect(scene.get(id)!.pose).toBe(before);
    expect(draws.get(id)!.committed).toBe(before);
  });

  it('moves the ghost along the ground plane, not through it', () => {
    const scene = createSolidScene();
    const feed = createPoseFeed(scene);
    const draws = new Map<NodeId, SolidRecord>();
    applyFeedDelta(draws, feed.read());

    const id = firstId(scene);
    const before = scene.get(id)!.pose;
    startDrag(scene, id);
    applyFeedDelta(draws, feed.read());

    const [ghost] = solidsToDraw(draws, new Set<NodeId>()).filter((s) => s.ghost);
    expect(ghost.pose.position.x).not.toBeCloseTo(before.position.x, 3);
    expect(ghost.pose.position.y).toBeCloseTo(before.position.y, 6);
  });
});

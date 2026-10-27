/**
 * The lab's retained draw records, patched from the pose feed.
 *
 * A record holds two poses because the feed hands over both: `committed` is
 * what the document stores, `pose` is what a gesture in flight is showing. They
 * are the same object until an action publishes an override, which is what
 * makes the identity check below the whole test for "in flight".
 *
 * `moveAction` declares the kit's default `previewHidesSource: true`, where the
 * ghost replaces the solid. The lab keeps the solid drawn at its committed pose
 * instead, so a drag shows what moved and from where.
 */

import { documentOf, type FeedDelta, type NodeId } from '@weasel-js/core';
import { worldPoseOf } from '@weasel-js/kernel3d';
import type { SolidDraw } from './renderer3d';
import type { Pose3, SolidData, SolidKind, SolidLayer, SolidScene } from './scene3d';

export interface SolidRecord {
  /** What the document stores, in the node's container frame. */
  committed: Pose3;
  /** The committed pose, or the one a gesture is proposing, in the same frame. */
  pose: Pose3;
  /** `null` for a container, which draws nothing. */
  kind: SolidKind | null;
  color: string;
}

export type SolidDelta = FeedDelta<SolidData, SolidLayer, Pose3>;

/** Patch `draws` in place from one feed read. */
export function applyFeedDelta(draws: Map<NodeId, SolidRecord>, delta: SolidDelta): void {
  if (delta.reset) draws.clear();
  for (const id of delta.removed) draws.delete(id);
  for (const entry of [...delta.added, ...delta.changed]) {
    draws.set(entry.node.id, {
      committed: entry.node.pose,
      pose: entry.pose,
      kind: entry.node.kind === 'group' ? null : entry.node.data.kind,
      color: entry.node.data.color,
    });
  }
}

/** Whether a gesture is moving `id` or any container above it. */
function inFlight(scene: SolidScene, draws: ReadonlyMap<NodeId, SolidRecord>, id: NodeId): boolean {
  for (let at: NodeId | null = id; at !== null; at = scene.get(at)?.parent ?? null) {
    const draw = draws.get(at);
    if (draw && draw.pose !== draw.committed) return true;
  }
  return false;
}

/**
 * The draw list for one frame: every solid at its committed world pose, plus a
 * ghost at the shown one for each solid a gesture has moved, itself or through
 * a container. Records hold poses in container frames; the world poses come
 * from the scene, folded through every container above.
 *
 * Selection is stamped on here rather than stored in the record because it
 * moves on its own clock, and a ghost never carries it — the chrome tracks the
 * committed solid.
 */
export function solidsToDraw(
  scene: SolidScene,
  draws: ReadonlyMap<NodeId, SolidRecord>,
  selected: ReadonlySet<NodeId>,
): SolidDraw[] {
  const solids: SolidDraw[] = [];
  const ghosts: SolidDraw[] = [];
  const document = documentOf(scene);
  for (const [id, draw] of draws) {
    if (draw.kind === null) continue;
    const shown = worldPoseOf(scene, id);
    if (shown === undefined) continue;
    const moving = inFlight(scene, draws, id);
    solids.push({
      pose: moving ? worldPoseOf(document, id)! : shown,
      kind: draw.kind,
      color: draw.color,
      selected: selected.has(id),
    });
    if (moving) ghosts.push({ pose: shown, kind: draw.kind, color: draw.color, selected: false, ghost: true });
  }
  return [...solids, ...ghosts];
}

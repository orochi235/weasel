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

import type { FeedDelta, NodeId } from '@weasel-js/core';
import type { SolidDraw } from './renderer3d';
import type { Pose3, SolidData, SolidKind, SolidLayer } from './scene3d';

export interface SolidRecord {
  /** What the document stores. */
  committed: Pose3;
  /** What to draw: the committed pose, or the one a gesture is proposing. */
  pose: Pose3;
  kind: SolidKind;
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
      kind: entry.node.data.kind,
      color: entry.node.data.color,
    });
  }
}

/**
 * The draw list for one frame: every solid at its committed pose, plus a ghost
 * for each one a gesture has moved.
 *
 * Selection is stamped on here rather than stored in the record because it
 * moves on its own clock, and a ghost never carries it — the chrome tracks the
 * committed solid.
 */
export function solidsToDraw(
  draws: ReadonlyMap<NodeId, SolidRecord>,
  selected: ReadonlySet<NodeId>,
): SolidDraw[] {
  const solids: SolidDraw[] = [];
  const ghosts: SolidDraw[] = [];
  for (const [id, draw] of draws) {
    solids.push({
      pose: draw.committed,
      kind: draw.kind,
      color: draw.color,
      selected: selected.has(id),
    });
    if (draw.pose !== draw.committed) {
      ghosts.push({ pose: draw.pose, kind: draw.kind, color: draw.color, selected: false, ghost: true });
    }
  }
  return [...solids, ...ghosts];
}

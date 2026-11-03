import type { Op } from 'core/ops/types';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { createSetDataOp } from 'core/ops/setData';
import { createTransformOp } from 'core/ops/transform';
import { deleteNode, insertAt } from 'interactions/actions/pathCommands/pathNodes';
import {
  measureEndsOf, measureNode, measurePose, withMeasureEnd,
  type MeasureData, type MeasureEnd, type MeasureFrameAt, type MeasureFrames, type MeasurePoint,
} from './measurement';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

/** The labels measurement edits land in history under. */
export const MEASURE_LABELS = {
  add: 'Measure',
  moveEnd: 'Move Measurement End',
  move: 'Move Measurement',
  delete: 'Delete Measurement',
  clear: 'Clear Measurements',
} as const;

/** The op adding a measurement from `start` to `end` on `layer`, at the top,
 *  its ends landed in `frames`. */
export function addMeasureOp(
  scene: AnyScene,
  layer: string,
  start: MeasurePoint,
  end: MeasurePoint,
  frames?: MeasureFrames,
): { id: NodeId; op: Op } {
  const id = scene.mintId();
  return { id, op: insertAt(measureNode(id, layer, start, end, frames), -1, MEASURE_LABELS.add) };
}

/** `node` as it reads after `next`: what an edit writes and its preview shows. */
function changeOps(node: AnyNode, next: { data: MeasureData; pose: unknown }, label: string): Op[] {
  return [
    createTransformOp({ id: node.id, from: node.pose, to: next.pose, label }),
    createSetDataOp({ id: node.id, from: node.data, to: next.data, label }),
  ];
}

/** The ops moving `node`'s `which` end to `to`, landed in `frame`. */
export function moveEndOps(node: AnyNode, which: MeasureEnd, to: MeasurePoint, frame?: NodeId | null): Op[] {
  const next = withMeasureEnd(node, which, to, frame);
  return next ? changeOps(node, next, MEASURE_LABELS.moveEnd) : [];
}

/** `node` carried by `(dx, dy)`, both ends together, each landing where
 *  `frameAt` says. Without `frameAt` the ends keep the frames they had. */
export function translatedMeasure(
  node: AnyNode,
  dx: number,
  dy: number,
  frameAt?: MeasureFrameAt,
): { data: MeasureData; pose: unknown } | null {
  const ends = measureEndsOf(node);
  if (!ends) return null;
  const start = { x: ends.start.x + dx, y: ends.start.y + dy };
  const end = { x: ends.end.x + dx, y: ends.end.y + dy };
  const frames = frameAt ? { start: frameAt(start), end: frameAt(end) } : ends.frames;
  const measure = { start, end, ...(frames ? { frames } : {}) };
  return { data: { ...(node.data as MeasureData), measure }, pose: measurePose(start, end) };
}

/** The ops carrying `node` by `(dx, dy)`, its ends landing where `frameAt` says. */
export function moveMeasureOps(node: AnyNode, dx: number, dy: number, frameAt?: MeasureFrameAt): Op[] {
  const next = translatedMeasure(node, dx, dy, frameAt);
  return next ? changeOps(node, next, MEASURE_LABELS.move) : [];
}

/** The ops deleting each of `ids`, as one edit labeled `label`. */
export function deleteMeasureOps(scene: AnyScene, ids: readonly NodeId[], label: string): Op[] {
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (node) ops.push(deleteNode(scene, node, label));
  }
  return ops;
}

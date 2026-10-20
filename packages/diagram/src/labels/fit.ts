/**
 * A label's box follows its text: an edit that changes a label's data sizes
 * it to the text it now holds, so what it covers and what covers it are
 * measured from the words drawn, not the empty box it was added with.
 */
import { createTransformOp, type NodeId, type Op, type Scene, type SceneEditSummary } from '@weasel-js/core';
import type { MeasureRowText, RowTextStyle } from '../body';
import { DEFAULT_FONT, labelSize, labelStyleOf } from '../edgeLabel';
import { diagramLabelOf } from '../labelTrait';

type Size = { width: number; height: number };

const isRect = (pose: unknown): pose is Size & { x: number; y: number } =>
  typeof pose === 'object' && pose !== null && typeof (pose as Size).width === 'number' && typeof (pose as Size).height === 'number';

/** The pose writes sizing each label whose data `summary`'s edit changed to its
 *  text, and the size each now takes, by id. A pose without a width and a
 *  height is left alone. */
export function labelFitOps(
  scene: Scene<unknown, string, unknown>,
  summary: SceneEditSummary,
  measure?: MeasureRowText,
): { ops: Op[]; sizes: Map<string, Size> } {
  const ops: Op[] = [];
  const sizes = new Map<string, Size>();
  for (const id of summary.dataChanged) {
    const node = scene.get(id as NodeId);
    if (node === undefined || diagramLabelOf(node) === null || !isRect(node.pose)) continue;
    const data = node.data as { text?: unknown; style?: RowTextStyle };
    if (typeof data.text !== 'string') continue;
    const size = labelSize(data.text, data.style ?? labelStyleOf(DEFAULT_FONT), measure);
    if (Math.abs(size.width - node.pose.width) < 1e-6 && Math.abs(size.height - node.pose.height) < 1e-6) continue;
    sizes.set(id, size);
    ops.push(createTransformOp({ id, from: node.pose, to: { ...node.pose, ...size }, label: 'Fit label' }));
  }
  return { ops, sizes };
}

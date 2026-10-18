import type { Node } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import type { DrawCommand } from '@weasel-js/renderer';
import { defaultDrawOne } from '../../canvas/defaultDrawOne';
import type { NodePaintCtx } from '../../canvas/NodeShape';

/** A scene `drawOne` that leaves out one node's glyphs. */
export type EditingDrawOne = <TNode extends Node<unknown, string, unknown>>(
  node: TNode, pose: unknown, view?: View, ctx?: NodePaintCtx,
) => DrawCommand[];

/** `defaultDrawOne`, less the text commands of the node `editingId` names. */
export function drawOneEditing(editingId: string | null): EditingDrawOne {
  return (node, pose, view, ctx) => {
    const out = defaultDrawOne(node, pose, view, ctx);
    return node.id === editingId ? out.filter((c) => c.kind !== 'text') : out;
  };
}

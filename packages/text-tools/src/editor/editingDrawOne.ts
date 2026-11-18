import type { DrawCommand } from '@weasel-js/renderer';
import { defaultDrawOne, type SceneNode as Node, type NodePaintCtx, type View } from '@weasel-js/core';

/** A scene `drawOne` that leaves out one node's glyphs. */
export type EditingDrawOne = <TNode extends Node<unknown, string, unknown>>(
  node: TNode, pose: unknown, view?: View, ctx?: NodePaintCtx,
) => DrawCommand[];

/** `base`, `defaultDrawOne` by default, less the text commands of the node `editingId` names. */
export function drawOneWithoutEditedText(editingId: string | null, base: EditingDrawOne = defaultDrawOne): EditingDrawOne {
  return (node, pose, view, ctx) => {
    const out = base(node, pose, view, ctx);
    return node.id === editingId ? withoutText(out) : out;
  };
}

/** `cmds` with every text command gone, at any depth, and any group left
 *  empty by it — a clipped node's glyphs ride in one. What the canvas keeps of
 *  a node an editor's overlay stands in for. */
export function withoutText(cmds: readonly DrawCommand[]): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (const c of cmds) {
    if (c.kind === 'text') continue;
    if (c.kind !== 'group') {
      out.push(c);
      continue;
    }
    const children = withoutText(c.children);
    if (children.length > 0) out.push({ ...c, children });
  }
  return out;
}

import type { DrawCommand, GroupDrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';

interface HierarchicalAdapter<TNode, TPose> {
  getLayers(): readonly { id: string; visible: boolean }[];
  getNode(id: string): TNode | undefined;
  getChildren(parentId: string | null): readonly string[];
  getPose(id: string): TPose;
}

/**
 * Walk the adapter's scene tree and emit nested `GroupDrawCommand`s,
 * grouped by layer. One top-level group per visible layer (in adapter
 * order); within each layer, the roots whose `layer` matches are walked
 * as subtrees.
 *
 * Each node produces a wrapper group containing:
 *  - its own paint (`drawOne(node, pose, view)`)
 *  - one subgroup per child, recursively
 *
 * A leaf with no children still gets a wrapper group — phase 2 attaches
 * per-node effects (clip path, etc.) to this wrapper, so the structure
 * needs to be stable regardless of whether the node has children.
 */
export function buildSceneTree<
  TNode extends { id: string; layer: string },
  TPose,
>(
  adapter: HierarchicalAdapter<TNode, TPose>,
  drawOne: (obj: TNode, pose: TPose, view: View) => DrawCommand[],
  view: View,
): DrawCommand[] {
  const out: DrawCommand[] = [];

  function buildNodeGroup(id: string): GroupDrawCommand {
    const node = adapter.getNode(id);
    if (!node) return { kind: 'group', children: [] };
    const pose = adapter.getPose(id);
    const self = drawOne(node, pose, view);
    const childIds = adapter.getChildren(id);
    const children: DrawCommand[] = [...self];
    for (const cid of childIds) {
      children.push(buildNodeGroup(cid));
    }

    const group: GroupDrawCommand = { kind: 'group', children };
    const maybeContainer = node as { kind?: string; clipFromPose?: (pose: TPose) => unknown };
    if (maybeContainer.kind === 'container' && typeof maybeContainer.clipFromPose === 'function') {
      const clip = maybeContainer.clipFromPose(pose);
      if (clip) group.clip = clip as GroupDrawCommand['clip'];
    }
    return group;
  }

  for (const layer of adapter.getLayers()) {
    if (!layer.visible) continue;
    const layerGroup: GroupDrawCommand = { kind: 'group', children: [] };
    for (const rootId of adapter.getChildren(null)) {
      const rootNode = adapter.getNode(rootId);
      if (!rootNode || rootNode.layer !== layer.id) continue;
      layerGroup.children.push(buildNodeGroup(rootId));
    }
    out.push(layerGroup);
  }
  return out;
}

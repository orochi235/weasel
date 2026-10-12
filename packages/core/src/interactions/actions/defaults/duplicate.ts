import type { Action } from '@weasel-js/routing';
import { composesFrames } from 'core/scene/composePose';
import { createElement } from 'react';
import { DuplicateIcon } from './icons/editIcons';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { copySelection } from './copySubtree';
import { requiresSelection } from './requiresSelection';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { translatePoseViaDescriptor } from '../resize/geometry';

/** Same nudge `sceneToAdapter.getPasteOffset` gives a paste, so duplicate and
 *  paste land in the same place rather than disagreeing by a few units. */
const DUPLICATE_OFFSET = 12;

/**
 * @experimental
 * Static descriptor for the `duplicate` Action. Copies each selected node —
 * with its subtree, so duplicating a group produces a populated group — offset
 * by a small nudge, as one undoable batch, then selects the copies.
 */
export const duplicateAction: Action & { requires: string[] } = {
  id: 'duplicate',
  label: 'Duplicate',
  icon: createElement(DuplicateIcon),
  group: 'edit',
  defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } },
  eligible: { capability: ['edits-page', 'creates-selection'] },
  // `selection` is read by the `enabled` gate as well as the invoker. An
  // undeclared read throws inside the dev-build deps Proxy before the gate can
  // answer, which is how this action spent a while doing nothing at all.
  requires: ['scene', 'selection', 'applyOps', 'poseDescriptor'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection;
      const scene = deps.scene;
      const applyOps = deps.applyOps;
      if (!selection || !scene) return;
      const ids = selection.get();
      if (ids.length === 0) return;

      const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(deps.poseDescriptor));
      // Under a frame a child's pose is relative, so offsetting the root
      // carries the subtree and offsetting a child again would double it.
      const offsetDescendants = !composesFrames(scene.composition);
      const { ops, copies: newIds } = copySelection(
        scene,
        ids,
        (id, node, isRoot) => (isRoot || offsetDescendants
          ? translatePoseViaDescriptor(node.pose, DUPLICATE_OFFSET, DUPLICATE_OFFSET, descriptorOf(id))
          : node.pose),
        'Duplicate',
      );

      if (ops.length === 0) return;
      if (applyOps) applyOps(ops, 'Duplicate');
      else scene.applyBatch(ops, 'Duplicate', defaultCommitAdapter(scene, selection.adapterMethods));
      selection.set(newIds);
    },
  },
  enabled: requiresSelection,
};

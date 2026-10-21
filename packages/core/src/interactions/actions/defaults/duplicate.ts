import type { Action, ActionDeps } from '@weasel-js/routing';
import { composesFrames } from 'core/scene/composePose';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { copySelection } from './copySubtree';
import { requiresSelection } from './requiresSelection';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { translatePoseViaDescriptor } from '../resize/geometry';
import { scenePoseFrame } from '../poseFrame';
import { storedDelta } from '../selectionSubtree';
import { recordTransform } from '../transform-again/memory';
import { icon } from '../../../icons.gen';

/** Same nudge `sceneToAdapter.getPasteOffset` gives a paste, so duplicate and
 *  paste land in the same place rather than disagreeing by a few units. */
export const DUPLICATE_OFFSET = 12;

/**
 * Copy each selected node, with its subtree, offset by `(dx, dy)` in world
 * space whatever frame it is stored in, as one
 * undoable batch labeled `label`, and select the copies. Returns the copies'
 * ids, or null when nothing was copied.
 */
export function duplicateSelection(
  deps: ActionDeps,
  dx: number,
  dy: number,
  label = 'Duplicate',
): string[] | null {
  const selection = deps.selection;
  const scene = deps.scene;
  const applyOps = deps.applyOps;
  if (!selection || !scene) return null;
  const ids = selection.get();
  if (ids.length === 0) return null;

  const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(deps.poseDescriptor));
  const frame = scenePoseFrame(scene);
  // Under a frame a child's pose is relative, so offsetting the root
  // carries the subtree and offsetting a child again would double it.
  const offsetDescendants = !composesFrames(scene.composition);
  const { ops, copies } = copySelection(
    scene,
    ids,
    (id, node, isRoot) => {
      if (!isRoot && !offsetDescendants) return node.pose;
      const l = storedDelta(frame, descriptorOf(id), id, dx, dy);
      return translatePoseViaDescriptor(node.pose, l.dx, l.dy, descriptorOf(id));
    },
    label,
  );

  if (ops.length === 0) return null;
  if (applyOps) applyOps(ops, label);
  else scene.applyBatch(ops, label, defaultCommitAdapter(scene, selection.adapterMethods));
  selection.set(copies);
  return copies as string[];
}

/**
 * Static descriptor for the `duplicate` Action. Copies each selected node —
 * with its subtree, so duplicating a group produces a populated group — offset
 * by a small nudge, as one undoable batch, then selects the copies.
 */
export const duplicateAction: Action & { requires: string[] } = {
  id: 'duplicate',
  label: 'Duplicate',
  icon: icon('duplicate'),
  group: 'edit',
  // Cmd/Ctrl+D is `transformAgain`, which duplicates when nothing else is
  // there to repeat.
  defaultBinding: [{ spec: { kind: 'key', key: ['d', 'D'], mods: { mod: true, shift: true } }, opts: { id: 'duplicate.key' } }],
  eligible: { capability: ['edits-page', 'creates-selection'] },
  // `selection` is read by the `enabled` gate as well as the invoker. An
  // undeclared read throws inside the dev-build deps Proxy before the gate can
  // answer, which is how this action spent a while doing nothing at all.
  requires: ['scene', 'selection', 'applyOps', 'poseDescriptor'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      const selection = deps.selection;
      if (!scene || !selection) return;
      const copies = duplicateSelection(deps, DUPLICATE_OFFSET, DUPLICATE_OFFSET);
      if (copies) recordTransform(scene, { kind: 'duplicate', dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET }, copies);
    },
  },
  enabled: requiresSelection,
};

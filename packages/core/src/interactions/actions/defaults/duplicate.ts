import type { Action, ActionDeps } from '@weasel-js/routing';
import { commitOps } from '../defaultCommitAdapter';
import { copySelection } from './copySubtree';
import { requiresSelection } from './requiresSelection';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { translatePoseViaDescriptor } from '../resize/geometry';
import { scenePoseFrame } from '../poseFrame';
import { storedDelta } from '../selectionSubtree';
import { recordTransform } from '../transform-again/memory';
import { icon } from '../../../icons.gen';
import { BETWEEN_GESTURES } from '@weasel-js/routing';
import { pref } from '@weasel-js/prefs';

/** Same nudge `sceneToAdapter.getPasteOffset` gives a paste, so duplicate and
 *  paste land in the same place rather than disagreeing by a few units. */
export const DUPLICATE_OFFSET = 12;

const offsetLeaf = (name: string, axis: string) => pref.number(name, DUPLICATE_OFFSET, {
  description: `How far the copies land from the originals ${axis}, in world units.`, min: -500, max: 500, step: 1,
});

/** Duplicate's params as a form: the last-operation panel's after a run. */
export const DUPLICATE_PARAMS = pref.group('Duplicate', {
  dx: offsetLeaf('Horizontal offset', 'across'),
  dy: offsetLeaf('Vertical offset', 'down'),
});

const offsetOf = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : DUPLICATE_OFFSET);

/**
 * Copy each selected node, with its subtree, offset by `(dx, dy)` in world
 * space whatever frame it is stored in, as one
 * undoable batch labeled `label`, and select the copies. Returns the copies'
 * ids, or null when nothing was copied or the scene refused the copies.
 */
export function duplicateSelection(
  deps: ActionDeps,
  dx: number,
  dy: number,
  label = 'Duplicate',
): string[] | null {
  const selection = deps.selection;
  const scene = deps.scene;
  if (!selection || !scene) return null;
  const ids = selection.get();
  if (ids.length === 0) return null;

  const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(deps.poseDescriptor));
  const frame = scenePoseFrame(scene);
  const { ops, copies } = copySelection(
    scene,
    ids,
    (id, node, isRoot) => {
      // A child's pose is relative to its frame, which the root's offset carries.
      if (!isRoot) return node.pose;
      const l = storedDelta(frame, descriptorOf(id), id, dx, dy);
      return translatePoseViaDescriptor(node.pose, l.dx, l.dy, descriptorOf(id));
    },
    label,
  );

  if (ops.length === 0) return null;
  return commitOps(deps, ops, label, { select: copies }) ? copies as string[] : null;
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
  defaultBinding: [{ spec: { kind: 'key', key: 'd', mods: { mod: true, shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'duplicate.key' } }],
  eligible: { capability: ['edits-page', 'creates-selection'] },
  // `selection` is read by the `enabled` gate as well as the invoker. An
  // undeclared read throws inside the dev-build deps Proxy before the gate can
  // answer, which is how this action spent a while doing nothing at all.
  requires: ['scene', 'selection', 'applyOps', 'poseDescriptor'],
  params: DUPLICATE_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const scene = deps.scene;
      const selection = deps.selection;
      if (!scene || !selection) return;
      const dx = offsetOf(params?.dx);
      const dy = offsetOf(params?.dy);
      const copies = duplicateSelection(deps, dx, dy);
      if (copies) recordTransform(scene, { kind: 'duplicate', dx, dy }, copies);
    },
  },
  enabled: requiresSelection,
};

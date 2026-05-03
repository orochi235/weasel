/**
 * Structural-group action hooks: real scene-graph hierarchy, distinct from
 * the virtual-lasso `useGroup` / `useUngroup`.
 *
 * Where the virtual variant inserts a `Group` *record* alongside the scene
 * (members listed in a separate Map), the structural variant inserts a real
 * scene object the consumer constructs, then reparents the would-be members
 * under it via the existing `setParent` adapter method.
 *
 * Pose semantics: poses are local — relative to the direct parent. The hook
 * uses `composeWorldPose` to compute world positions and `rebaseLocalPose`
 * to rebase a child's local pose into a new parent's frame so the child's
 * visual world position is preserved across the reparent.
 *
 * Consumer responsibilities:
 *   - Provide a `groupFactory` that mints the new group scene object given
 *     its id, local pose, and child id list.
 *   - Provide `composePose` / `decomposePose` for the kit's pose shape (use
 *     `composeRectPose` / `decomposeRectPose` for axis-aligned rects).
 *   - Implement `getChildren(id)` so ungroup can find the group's members.
 *
 * Multi-parent selections: if the selection spans multiple distinct parents,
 * the hook resolves the new group's parent to the first selected child's
 * parent (the others get reparented to the new group regardless). Visually
 * this is transparent because every child's local pose is rebased.
 */

import { useCallback, useRef } from 'react';
import { createInsertOp } from '../../../core/ops/create';
import { createDeleteOp } from '../../../core/ops/delete';
import { createReparentOp } from '../../../core/ops/reparent';
import { createTransformOp } from '../../../core/ops/transform';
import { createSetSelectionOp } from '../../../core/ops/select';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/ops/applyOpsTo';
import {
  composeWorldPose,
  rebaseLocalPose,
  type PoseAdapter,
} from '../../../features/groups/composePose';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useNestedGroup` / `useNestedUngroup`. */
export interface NestedGroupActionAdapter<TObject extends { id: string }, TPose>
  extends PoseAdapter<TPose> {
  /** Read current selection. */
  getSelection(): string[];
  /** Look up an existing scene object — used by ungroup to recover the group
   *  object so the dissolve op can invert into a re-insert. */
  getObject(id: string): TObject | undefined;
  /** Enumerate direct children of `id` (`null` = root siblings). Required
   *  for ungroup to find the members of a nested group. Order doesn't
   *  matter for the hook itself; the hook does not reorder children. */
  getChildren(id: string | null): string[];
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyBatch?(ops: Op[], label: string): void;
}

/** Options for `useNestedGroup`. */
export interface UseNestedGroupOptions<TObject extends { id: string }, TPose> {
  /** Mint the new group scene object. Receives the chosen group id, the
   *  group's local pose (in the common parent's frame), and the child ids.
   *  The returned object is inserted into the scene before children are
   *  reparented under it. */
  groupFactory: (args: { id: string; localPose: TPose; childIds: string[] }) => TObject;
  /** Compose a parent local + child local into the equivalent pose one frame
   *  up. For axis-aligned rects, pass `composeRectPose`. */
  composePose: (parent: TPose, child: TPose) => TPose;
  /** Inverse of `composePose`: recover a child's local from its world pose
   *  given the parent's world pose. For axis-aligned rects, pass
   *  `decomposeRectPose`. */
  decomposePose: (parent: TPose, world: TPose) => TPose;
  /** Compute the group's local pose given the world poses of its children.
   *  Default: a `{x, y, width, height}` union AABB cast through the pose
   *  shape (works when TPose extends `{x, y, width, height}`). Override to
   *  anchor the group elsewhere — e.g., at the first child's origin, or to
   *  carry extra non-rect fields. */
  groupPoseFromChildren?: (childWorldPoses: TPose[]) => TPose;
  /** Auto-bind Mod+G on document. Default false. */
  bindKeyboard?: boolean;
  /** Mint the id for the new group. Default: `g_${time}_${random}`. */
  newGroupId?: () => string;
  /** Label passed to applyBatch. Default 'Group'. */
  label?: string;
  /** Minimum selection size that produces a group. Default 2 — wrapping a
   *  single object adds no structure. */
  minMembers?: number;
}

/** Return shape of `useNestedGroup`. */
export interface UseNestedGroupReturn {
  /** Imperative trigger — reparents the current selection under a newly
   *  inserted group object, rebasing each child's local pose so its visual
   *  world position is preserved. Returns the new group id, or `null` if no
   *  group was created (selection too small). */
  group(): string | null;
}

function defaultMintId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface RectLike { x: number; y: number; width: number; height: number }

function defaultGroupPoseFromChildren<TPose>(world: TPose[]): TPose {
  if (world.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 } as unknown as TPose;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of world as unknown as RectLike[]) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + p.width > maxX) maxX = p.x + p.width;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY } as unknown as TPose;
}

/** Selection-grouping action that inserts a real scene-graph parent and
 *  reparents the selection under it. Optionally binds Mod+G. */
export function useNestedGroup<TObject extends { id: string }, TPose>(
  adapter: NestedGroupActionAdapter<TObject, TPose>,
  options: UseNestedGroupOptions<TObject, TPose>,
): UseNestedGroupReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const group = useCallback((): string | null => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    const min = o.minMembers ?? 2;
    if (sel.length < min) return null;

    // Common-parent resolution: take the first selected child's parent.
    // Children with different parents still get reparented under the new
    // group — visually preserved by the rebase below.
    const newGroupParent = a.getParent(sel[0]);

    // Snapshot world poses *before* any mutation, so the group pose and the
    // child rebase use the pre-group geometry.
    const childWorldPoses = sel.map((id) => composeWorldPose(a, id, o.composePose));

    const groupPoseFromChildren = o.groupPoseFromChildren ?? defaultGroupPoseFromChildren;
    const groupLocalInRoot = groupPoseFromChildren(childWorldPoses);
    // The pose we just computed treats children's world poses as if the
    // group lived at world origin. Shift it into the common-parent frame.
    const groupLocal = newGroupParent === null
      ? groupLocalInRoot
      : o.decomposePose(composeWorldPose(a, newGroupParent, o.composePose), groupLocalInRoot);

    const groupId = (o.newGroupId ?? defaultMintId)();
    const groupObject = o.groupFactory({ id: groupId, localPose: groupLocal, childIds: [...sel] });

    // Synthesize a temporary adapter view that knows the group's eventual
    // world pose, so we can rebase children into the group's frame without
    // having actually inserted the group yet.
    const groupWorld = newGroupParent === null
      ? groupLocal
      : o.composePose(composeWorldPose(a, newGroupParent, o.composePose), groupLocal);

    const ops: Op[] = [];
    ops.push(createInsertOp({ object: groupObject }));
    if (newGroupParent !== null) {
      ops.push(createReparentOp({ id: groupId, from: null, to: newGroupParent }));
    }
    for (let i = 0; i < sel.length; i++) {
      const childId = sel[i];
      const oldParent = a.getParent(childId);
      const childLocalBefore = a.getPose(childId);
      const childWorld = childWorldPoses[i];
      const childLocalAfter = o.decomposePose(groupWorld, childWorld);
      if (oldParent !== groupId) {
        ops.push(createReparentOp({ id: childId, from: oldParent, to: groupId }));
      }
      ops.push(createTransformOp({ id: childId, from: childLocalBefore, to: childLocalAfter }));
    }
    ops.push(createSetSelectionOp({ from: sel, to: [groupId] }));

    dispatchApplyBatch(a, ops, o.label ?? 'Group');
    return groupId;
  }, []);

  useKeybinding(
    { key: 'g', mod: true, enabled: !!options.bindKeyboard },
    () => { group(); },
  );

  return { group };
}

/** Options for `useNestedUngroup`. */
export interface UseNestedUngroupOptions<TObject extends { id: string }, TPose> {
  /** Compose a parent local + child local into the next-frame-up pose. */
  composePose: (parent: TPose, child: TPose) => TPose;
  /** Inverse of `composePose`. */
  decomposePose: (parent: TPose, world: TPose) => TPose;
  /** Auto-bind Mod+Shift+G on document. Default false. */
  bindKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Ungroup'. */
  label?: string;
  /** Predicate: should this id be treated as a nested group (i.e.
   *  dissolved on ungroup)? Default: any id with at least one child. Override
   *  if your scene model distinguishes "container" from "ordinary parent"
   *  via a domain field on the object. */
  isGroup?: (id: string, object: TObject | undefined) => boolean;
}

/** Return shape of `useNestedUngroup`. */
export interface UseNestedUngroupReturn {
  /** Imperative trigger — for every group in the current selection,
   *  reparents its children to the grandparent (rebasing each local pose so
   *  visual world positions are preserved) and deletes the group object.
   *  New selection: the surfaced children plus any non-group ids that were
   *  already selected. Returns the ids of dissolved groups, or `[]` if none
   *  were found. */
  ungroup(): string[];
}

/** Selection-ungrouping action; optionally binds Mod+Shift+G. */
export function useNestedUngroup<TObject extends { id: string }, TPose>(
  adapter: NestedGroupActionAdapter<TObject, TPose>,
  options: UseNestedUngroupOptions<TObject, TPose>,
): UseNestedUngroupReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const ungroup = useCallback((): string[] => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length === 0) return [];

    const isGroup = o.isGroup ?? ((id) => a.getChildren(id).length > 0);

    const dissolved: string[] = [];
    const nextSelection: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      nextSelection.push(id);
    };

    const ops: Op[] = [];
    for (const id of sel) {
      const obj = a.getObject(id);
      if (!isGroup(id, obj)) {
        push(id);
        continue;
      }
      const children = a.getChildren(id);
      const grandparent = a.getParent(id);
      // Snapshot world poses before mutation.
      const childWorlds = children.map((cid) => composeWorldPose(a, cid, o.composePose));
      for (let i = 0; i < children.length; i++) {
        const cid = children[i];
        const localBefore = a.getPose(cid);
        const localAfter = rebaseLocalPose(a, childWorlds[i], grandparent, o.composePose, o.decomposePose);
        ops.push(createReparentOp({ id: cid, from: id, to: grandparent }));
        ops.push(createTransformOp({ id: cid, from: localBefore, to: localAfter }));
        push(cid);
      }
      // Reparent the group to root before delete so the inverse insert puts
      // it back without needing to re-establish its old parent state — the
      // followup reparent inverse re-attaches it.
      if (grandparent !== null) {
        ops.push(createReparentOp({ id, from: grandparent, to: null }));
      }
      if (obj) {
        ops.push(createDeleteOp({ object: obj }));
      }
      dissolved.push(id);
    }
    if (dissolved.length === 0) return [];
    ops.push(createSetSelectionOp({ from: sel, to: nextSelection }));
    dispatchApplyBatch(a, ops, o.label ?? 'Ungroup');
    return dissolved;
  }, []);

  useKeybinding(
    { key: 'g', mod: true, shift: true, enabled: !!options.bindKeyboard },
    () => { ungroup(); },
  );

  return { ungroup };
}

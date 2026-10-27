import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { Op } from '@weasel-js/history';
import { createSetDataOp } from '@weasel-js/core';
import type { NodeId, Scene } from '@weasel-js/core';
import { defaultCommitAdapter } from '@weasel-js/core';
import { unplaceSkeleton, type RigNodeData } from '@weasel-js/core';
import { addJoint, dropSkinJoints, jointAt, jointPositions, moveJoint, removeJoint } from '@weasel-js/animator';
import type { Skeleton } from '@weasel-js/animator';
import { sceneReach, type PlacedRig } from './placedRig';
import type { RigEditState } from './rigEditState';
import type { ImmediateParams } from '@weasel-js/routing';

/** What the bone tool's actions read and write, all of it the tool's own. */
export interface BoneEnv {
  scene(): Scene<unknown, string, unknown>;
  /** The rig node and its skeleton in the scene's space, or `null` with nothing to edit. */
  placed(): PlacedRig | null;
  state: RigEditState;
  /** Screen px around a joint within which a press takes it. */
  reachPx(): number;
  /** Show `skeleton` in place of the document's while a drag shapes it; `null` ends that. */
  show(skeleton: Skeleton | null): void;
  shown(): Skeleton | null;
}

const eligible = { capability: 'edits-page' } as const;

const reachOf = (env: BoneEnv, deps: ActionDeps): number => sceneReach(deps, env.reachPx());

const activeIn = (env: BoneEnv, skeleton: Skeleton): string | null => {
  const name = env.state.active();
  return name !== null && skeleton.joints.some((j) => j.name === name) ? name : null;
};

/** Write `next`, a skeleton in the scene's space, into the rig node, and take `removed`
 *  joints out of the skins under it, as one undo entry. */
function commitSkeleton(
  scene: Scene<unknown, string, unknown>,
  deps: ActionDeps,
  id: NodeId,
  next: Skeleton,
  label: string,
  removed: readonly string[] = [],
): void {
  const node = scene.get(id);
  if (!node) return;
  const ops: Op[] = [createSetDataOp({
    id, from: node.data, to: { ...(node.data as object), skeleton: unplaceSkeleton(next, node.pose) }, label,
  })];
  const strip = (parent: NodeId): void => {
    for (const child of scene.childrenOf(parent)) {
      const data = scene.get(child)?.data as RigNodeData | null | undefined;
      const kept = data?.skin && dropSkinJoints(data.skin, removed);
      if (kept && kept !== data.skin) ops.push(createSetDataOp({ id: child, from: data, to: { ...data, skin: kept }, label }));
      strip(child);
    }
  };
  if (removed.length > 0) strip(id);
  if (deps.applyOps) deps.applyOps(ops, label);
  else scene.applyBatch(ops, label, defaultCommitAdapter(scene, deps.selection?.adapterMethods));
}

function dragAction(env: BoneEnv, editing: () => true | ActionDisabledReason): Action {
  return {
    id: 'bone.drag',
    label: 'Bone — move a joint or draw a bone',
    eligible,
    requires: ['view', 'selection', 'applyOps'],
    enabled: editing,
    invoker: {
      timing: 'ongoing',
      start: ({ deps, drag, world }: InvocationCtx) => {
        const at = env.placed();
        if (!at) return {};
        const press = drag?.start ?? world;
        const before = env.state.active();
        const hit = jointAt(at.skeleton, press.x, press.y, reachOf(env, deps));
        let origin = at.skeleton;
        let name = hit;
        if (name === null) {
          let parent = activeIn(env, origin);
          if (parent === null) ({ skeleton: origin, name: parent } = addJoint(origin, null, press.x, press.y));
          ({ skeleton: origin, name } = addJoint(origin, parent, press.x, press.y));
        }
        const joint = name;
        const from = jointPositions(origin).get(joint)!;
        env.state.setActive(joint);
        env.show(origin);
        return {
          onMove: (move: InvocationCtx) => {
            env.show(moveJoint(origin, joint, from.x + move.world.x - press.x, from.y + move.world.y - press.y));
          },
          // The dispatcher hands `onEnd` a context with empty deps.
          onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
            const next = env.shown();
            env.show(null);
            if (reason === 'cancel' || !next) {
              env.state.setActive(before);
              return;
            }
            commitSkeleton(env.scene(), deps, at.id, next, hit === null ? 'Add bone' : 'Move joint');
          },
        };
      },
    },
  };
}

/** The bone tool's actions: `bone.drag`, `bone.pick`, `bone.remove`, and `bone.clear`. */
export function createBoneActions(env: BoneEnv): Action[] {
  const editing = () => (env.placed() ? true : ActionDisabledReason.NotApplicable);
  const hasActive = () => {
    const at = env.placed();
    return at && activeIn(env, at.skeleton) !== null ? true : ActionDisabledReason.NotApplicable;
  };
  return [
    dragAction(env, editing),
    {
      id: 'bone.pick',
      label: 'Bone — pick the active joint',
      eligible,
      requires: ['view'],
      enabled: editing,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const press = (params as ImmediateParams | undefined)?.press;
          const at = env.placed();
          if (!at || !press) return;
          env.state.setActive(jointAt(at.skeleton, press.x, press.y, reachOf(env, deps)));
        },
      },
    },
    {
      id: 'bone.remove',
      label: 'Bone — remove the active joint',
      eligible,
      requires: ['selection', 'applyOps'],
      // Declining with no joint active leaves Delete to the ambient `delete`.
      enabled: hasActive,
      invoker: {
        timing: 'immediate',
        run: (deps) => {
          const at = env.placed();
          const name = at && activeIn(env, at.skeleton);
          if (!at || name == null) return;
          const parent = at.skeleton.joints.find((j) => j.name === name)!.parent;
          const { skeleton, removed } = removeJoint(at.skeleton, name);
          commitSkeleton(env.scene(), deps, at.id, skeleton, 'Remove joint', removed);
          env.state.setActive(parent);
        },
      },
    },
    {
      id: 'bone.clear',
      label: 'Bone — clear the active joint',
      eligible,
      enabled: hasActive,
      invoker: { timing: 'immediate', run: () => env.state.setActive(null) },
    },
  ];
}

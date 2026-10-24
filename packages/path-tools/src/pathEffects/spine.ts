/**
 * A blend's spine after the blend is made: lay it along a path, swap that
 * path for another, or let it go. The spine is the blend's third source, so
 * each is a retarget of the blend's `dependsOn`, undone as one step, that
 * moves the `hidden` flag with it as Set Path does where the blend hides its
 * sources.
 */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  commitOps, createSetDependsOnOp, type NodeId, type Op, pathEffectOf, type Scene, type SceneNode as Node, sourcesOf,
} from '@weasel-js/core';
import { PATH_EFFECTS_GROUP } from './actions';
import { releasedOps, takenOps } from './hiding';
import { closesLoop } from './retarget';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

const isBlend = (node: AnyNode | undefined): node is AnyNode =>
  node !== undefined && pathEffectOf(node)?.kind === 'blend' && sourcesOf(node).length >= 2;

/** The blend and the path to lay it along, from a selection of exactly those
 *  two in either order; a reason when the selection is not that. */
function spineTarget(deps: ActionDeps | undefined): { blend: AnyNode; spine: AnyNode } | ActionDisabledReason {
  const scene = deps?.scene as AnyScene | undefined;
  const nodes = (deps?.selection?.get() ?? []).map((id) => scene?.get(id as NodeId));
  if (!scene || nodes.length !== 2) return ActionDisabledReason.SelectionRequired;
  const blend = nodes.find(isBlend);
  const spine = nodes.find((n) => n !== blend);
  if (!blend || !spine || spine.kind !== 'mark' || closesLoop(scene, blend, spine)) return ActionDisabledReason.NotApplicable;
  return { blend, spine };
}

const SET_LABEL = 'Set Spine';

/**
 * Lay a blend's steps along a path: select the blend and the path, in either
 * order. A blend that already has a spine swaps it for this one, and the old
 * spine stays in the scene, shown again if the blend hid it.
 */
export const setBlendSpineAction: Action & { requires: string[] } = {
  id: 'setBlendSpine',
  label: SET_LABEL,
  group: PATH_EFFECTS_GROUP,
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const target = spineTarget(deps);
      if (typeof target === 'string') return;
      const scene = deps.scene as AnyScene;
      const { blend, spine } = target;
      const [a, b, old] = sourcesOf(blend);
      commitOps(deps, [
        createSetDependsOnOp({ id: blend.id, from: blend.dependsOn, to: [a!, b!, spine.id], label: SET_LABEL }),
        ...(old !== undefined ? releasedOps(scene, old, [blend], SET_LABEL) : []),
        ...takenOps(scene, blend, 2, spine.id, SET_LABEL),
      ], SET_LABEL);
      deps.selection?.set([blend.id] as never);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const target = spineTarget(deps);
    return typeof target === 'string' ? target : true;
  },
};

/** The selected blends that have a spine. */
function blendsWithSpines(deps: ActionDeps | undefined): AnyNode[] {
  const scene = deps?.scene as AnyScene | undefined;
  if (!scene) return [];
  return (deps?.selection?.get() ?? [])
    .map((id) => scene.get(id as NodeId))
    .filter((n): n is AnyNode => isBlend(n) && sourcesOf(n).length >= 3);
}

const RELEASE_LABEL = 'Release Spine';

/**
 * Take each selected blend off its spine, back to a straight run between its
 * two shapes, and select the spines: ordinary paths again, where they were,
 * and shown again where the blend hid them and nothing else still does.
 */
export const releaseBlendSpineAction: Action & { requires: string[] } = {
  id: 'releaseBlendSpine',
  label: RELEASE_LABEL,
  group: PATH_EFFECTS_GROUP,
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const ops: Op[] = [];
      const bySpine = new Map<NodeId, AnyNode[]>();
      for (const blend of blendsWithSpines(deps)) {
        const [a, b, spine] = sourcesOf(blend);
        ops.push(createSetDependsOnOp({ id: blend.id, from: blend.dependsOn, to: [a!, b!], label: RELEASE_LABEL }));
        bySpine.set(spine!, [...(bySpine.get(spine!) ?? []), blend]);
      }
      if (ops.length === 0) return;
      for (const [spine, blends] of bySpine) ops.push(...releasedOps(deps.scene as AnyScene, spine, blends, RELEASE_LABEL));
      commitOps(deps, ops, RELEASE_LABEL);
      deps.selection?.set([...bySpine.keys()] as never);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    if (blendsWithSpines(deps).length > 0) return true;
    return (deps?.selection?.get() ?? []).length > 0 ? ActionDisabledReason.NotApplicable : ActionDisabledReason.SelectionRequired;
  },
};

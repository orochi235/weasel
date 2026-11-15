/**
 * A tween's spine after the tween is made: lay it along a path, swap that
 * path for another, or let it go. The spine is the tween's third source, so
 * each is a retarget of the tween's `dependsOn`, undone as one step, that
 * moves the `hidden` flag with it as Set Path does where the tween hides its
 * sources.
 */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  commitOps,
  createSetDependsOnOp,
  type NodeId,
  type Op,
  pathEffectOf,
  type SceneNode as Node,
  sourcesOf,
  type AnyScene,
} from '@weasel-js/core';
import { PATH_EFFECTS_GROUP } from './actions';
import { releasedOps, takenOps } from './hiding';
import { closesLoop } from './retarget';
import { icon } from '../icons.gen';

type AnyNode = Node<unknown, string, unknown>;

const isTween = (node: AnyNode | undefined): node is AnyNode =>
  node !== undefined && pathEffectOf(node)?.kind === 'tween' && sourcesOf(node).length >= 2;

/** The tween and the path to lay it along, from a selection of exactly those
 *  two in either order; a reason when the selection is not that. */
function spineTarget(deps: ActionDeps | undefined): { tween: AnyNode; spine: AnyNode } | ActionDisabledReason {
  const scene = deps?.scene as AnyScene | undefined;
  const nodes = (deps?.selection?.get() ?? []).map((id) => scene?.get(id as NodeId));
  if (!scene || nodes.length !== 2) return ActionDisabledReason.SelectionRequired;
  const tween = nodes.find(isTween);
  const spine = nodes.find((n) => n !== tween);
  if (!tween || !spine || spine.kind !== 'mark' || closesLoop(scene, tween, spine)) return ActionDisabledReason.NotApplicable;
  return { tween, spine };
}

const SET_LABEL = 'Set Spine';

/**
 * Lay a tween's steps along a path: select the tween and the path, in either
 * order. A tween that already has a spine swaps it for this one, and the old
 * spine stays in the scene, shown again if the tween hid it.
 */
export const setTweenSpineAction: Action & { requires: string[] } = {
  id: 'setTweenSpine',
  label: SET_LABEL,
  icon: icon('setTweenSpine'),
  group: PATH_EFFECTS_GROUP,
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const target = spineTarget(deps);
      if (typeof target === 'string') return;
      const scene = deps.scene as AnyScene;
      const { tween, spine } = target;
      const [a, b, old] = sourcesOf(tween);
      commitOps(deps, [
        createSetDependsOnOp({ id: tween.id, from: tween.dependsOn, to: [a!, b!, spine.id], label: SET_LABEL }),
        ...(old !== undefined ? releasedOps(scene, old, [tween], SET_LABEL) : []),
        ...takenOps(scene, tween, 2, spine.id, SET_LABEL),
      ], SET_LABEL, { select: [tween.id] });
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const target = spineTarget(deps);
    return typeof target === 'string' ? target : true;
  },
};

/** The selected tweens that have a spine. */
function tweensWithSpines(deps: ActionDeps | undefined): AnyNode[] {
  const scene = deps?.scene as AnyScene | undefined;
  if (!scene) return [];
  return (deps?.selection?.get() ?? [])
    .map((id) => scene.get(id as NodeId))
    .filter((n): n is AnyNode => isTween(n) && sourcesOf(n).length >= 3);
}

const RELEASE_LABEL = 'Release Spine';

/**
 * Take each selected tween off its spine, back to a straight run between its
 * two shapes, and select the spines: ordinary paths again, where they were,
 * and shown again where the tween hid them and nothing else still does.
 */
export const releaseTweenSpineAction: Action & { requires: string[] } = {
  id: 'releaseTweenSpine',
  label: RELEASE_LABEL,
  icon: icon('releaseTweenSpine'),
  group: PATH_EFFECTS_GROUP,
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const ops: Op[] = [];
      const bySpine = new Map<NodeId, AnyNode[]>();
      for (const tween of tweensWithSpines(deps)) {
        const [a, b, spine] = sourcesOf(tween);
        ops.push(createSetDependsOnOp({ id: tween.id, from: tween.dependsOn, to: [a!, b!], label: RELEASE_LABEL }));
        bySpine.set(spine!, [...(bySpine.get(spine!) ?? []), tween]);
      }
      if (ops.length === 0) return;
      for (const [spine, tweens] of bySpine) ops.push(...releasedOps(deps.scene as AnyScene, spine, tweens, RELEASE_LABEL));
      commitOps(deps, ops, RELEASE_LABEL, { select: [...bySpine.keys()] });
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    if (tweensWithSpines(deps).length > 0) return true;
    return (deps?.selection?.get() ?? []).length > 0 ? ActionDisabledReason.NotApplicable : ActionDisabledReason.SelectionRequired;
  },
};

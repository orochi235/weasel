/**
 * An along effect's path after the effect is made: swap it for another, or
 * let the effect go and keep its sources. Each moves the `hidden` flag with
 * it where the effect hides its sources, and undoes as one step.
 */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  commitOps, createSetDependsOnOp, deleteNode, hiddenSourceDeleteOps, isTextData, type NodeId, type Op, pathEffectOf,
  type Scene, type SceneNode as Node, sourcesOf,
} from '@weasel-js/core';
import { PATH_EFFECTS_GROUP, selectedEffects } from './actions';
import { releasedOps, takenOps } from './hiding';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

/** Whether `effect` reading `target` would loop: `target` is already one of
 *  its sources, or derives from it. */
export function closesLoop(scene: AnyScene, effect: AnyNode, target: AnyNode): boolean {
  return sourcesOf(effect).includes(target.id) || scene.removalClosure([effect.id]).includes(target.id);
}

const ALONG_KINDS: readonly unknown[] = ['bendAlong', 'repeatAlong', 'textAlong'];

const isAlong = (node: AnyNode | undefined): node is AnyNode =>
  node !== undefined && ALONG_KINDS.includes(pathEffectOf(node)?.kind) && sourcesOf(node).length >= 2;

/** The along effect and the path to lay it along, from a selection of exactly
 *  those two in either order; a reason when the selection is not that. */
function pathTarget(deps: ActionDeps | undefined): { effect: AnyNode; path: AnyNode } | ActionDisabledReason {
  const scene = deps?.scene as AnyScene | undefined;
  const nodes = (deps?.selection?.get() ?? []).map((id) => scene?.get(id as NodeId));
  if (!scene || nodes.length !== 2) return ActionDisabledReason.SelectionRequired;
  const effect = nodes.find(isAlong);
  const path = nodes.find((n) => n !== effect);
  if (!effect || !path || path.kind !== 'mark' || closesLoop(scene, effect, path)) return ActionDisabledReason.NotApplicable;
  // Text has no outline of its own to lay text along.
  if (pathEffectOf(effect)?.kind === 'textAlong' && isTextData(path.data)) return ActionDisabledReason.NotApplicable;
  return { effect, path };
}

const SET_LABEL = 'Set Path';

/**
 * Lay a Bend, Repeat, or Text Along Path effect along another path: select the
 * effect and the path, in either order. With two along effects selected, the
 * first selected is the one retargeted. A text node cannot be a Text Along
 * Path's path. Where the effect hides its sources, the new path is hidden and
 * the old one shown again, unless another effect still hides it or it was
 * hidden before this one was made.
 */
export const setEffectPathAction: Action & { requires: string[] } = {
  id: 'setEffectPath',
  label: SET_LABEL,
  group: PATH_EFFECTS_GROUP,
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const target = pathTarget(deps);
      if (typeof target === 'string') return;
      const scene = deps.scene as AnyScene;
      const { effect, path } = target;
      const [shape, old] = sourcesOf(effect) as [NodeId, NodeId];
      commitOps(deps, [
        createSetDependsOnOp({ id: effect.id, from: effect.dependsOn, to: [shape, path.id], label: SET_LABEL }),
        ...releasedOps(scene, old, [effect], SET_LABEL),
        ...takenOps(scene, effect, 1, path.id, SET_LABEL),
      ], SET_LABEL);
      deps.selection?.set([effect.id] as never);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const target = pathTarget(deps);
    return typeof target === 'string' ? target : true;
  },
};

const RELEASE_LABEL = 'Release';

/**
 * Delete each selected path effect and select its sources, shown again where
 * it hid them — unless another effect still hides one.
 * An effect deleted along the way, one reading a released one, takes the
 * sources it hid with it.
 */
export const releasePathEffectAction: Action & { requires: string[] } = {
  id: 'releasePathEffect',
  label: RELEASE_LABEL,
  group: PATH_EFFECTS_GROUP,
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene as AnyScene | undefined;
      const effects = selectedEffects(deps);
      if (!scene || effects.length === 0) return;
      const leaving = new Set(effects.map((n) => n.id));
      const taken = new Set<NodeId>();
      const ops: Op[] = [];
      const sources: NodeId[] = [];
      const shown = new Set<NodeId>();
      for (const effect of effects) {
        if (taken.has(effect.id)) continue;
        for (const id of scene.removalClosure([effect.id])) taken.add(id);
        for (const source of sourcesOf(effect)) {
          if (scene.get(source) === undefined) continue;
          sources.push(source);
          if (shown.has(source)) continue;
          const show = releasedOps(scene, source, effects, RELEASE_LABEL, [effect]);
          if (show.length > 0) shown.add(source);
          ops.push(...show);
        }
        ops.push(deleteNode(scene, effect, RELEASE_LABEL));
      }
      ops.push(...hiddenSourceDeleteOps(scene, [...leaving], RELEASE_LABEL, shown));
      commitOps(deps, ops, RELEASE_LABEL);
      deps.selection?.set([...new Set(sources)].filter((id) => scene.get(id) !== undefined) as never);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => (selectedEffects(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired),
};

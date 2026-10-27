import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import type { Op } from '@weasel-js/history';
import { createSetDataOp } from '@weasel-js/core';
import type { NodeId, Scene } from '@weasel-js/core';
import { defaultCommitAdapter } from '@weasel-js/core';
import type { RigNodeData } from '@weasel-js/core';
import { jointAt } from '@weasel-js/animator';
import { skinnable, type Skin } from '@weasel-js/animator';
import { dataRestPath } from '@weasel-js/core';
import { brushWeights, setWeights } from '@weasel-js/animator';
import { sceneReach, type PlacedRig } from '../bone/placedRig';
import type { RigEditState } from '../bone/rigEditState';
import type { ImmediateParams } from '@weasel-js/routing';

/** One path under the rig node, where it is drawn, with the weights now showing. */
export interface WeighedPath {
  id: NodeId;
  path: PolygonPath;
  skin: Skin;
}

/** What the weight tool's actions read and write, all of it the tool's own. */
export interface WeightEnv {
  scene(): Scene<unknown, string, unknown>;
  placed(): PlacedRig | null;
  state: RigEditState;
  /** Screen px around a joint within which a click picks it. */
  reachPx(): number;
  /** The brush's radius in screen px. */
  radiusPx(): number;
  /** Weights a stroke has painted and not yet committed, by node. */
  painted(): ReadonlyMap<NodeId, Skin>;
  paint(next: ReadonlyMap<NodeId, Skin> | null): void;
}

/** Every path under the rig node, with what `env.painted()` holds for it in place of its
 *  `data.skin`. */
export function weighedPaths(env: Pick<WeightEnv, 'scene' | 'placed' | 'painted'>): WeighedPath[] {
  const rig = env.placed();
  if (!rig) return [];
  const scene = env.scene();
  const painted = env.painted();
  const out: WeighedPath[] = [];
  const walk = (parent: NodeId): void => {
    for (const id of scene.childrenOf(parent)) {
      const node = scene.get(id);
      const rest = node && dataRestPath(node);
      if (node && rest) {
        const skin = painted.get(id) ?? (node.data as RigNodeData | null | undefined)?.skin ?? {};
        out.push({ id, path: skinnable(rest), skin });
      }
      walk(id);
    }
  };
  walk(rig.id);
  return out;
}

const eligible = { capability: 'edits-page' } as const;

const activeJoint = (env: WeightEnv): string | null => {
  const name = env.state.active();
  return name !== null && env.placed()?.skeleton.joints.some((j) => j.name === name) ? name : null;
};

/** One dab of the brush at `(x, y)`: what `env.painted()` becomes, or `null` if no point moved. */
function dab(env: WeightEnv, deps: ActionDeps, joint: string, x: number, y: number, mode: 'add' | 'remove'): Map<NodeId, Skin> | null {
  const radius = sceneReach(deps, env.radiusPx());
  let next: Map<NodeId, Skin> | null = null;
  for (const { id, path, skin } of weighedPaths(env)) {
    const hits = brushWeights(path.coords, x, y, radius, skin[joint], mode);
    if (hits.size === 0) continue;
    next ??= new Map(env.painted());
    next.set(id, setWeights(skin, path.coords.length >> 1, joint, hits));
  }
  return next;
}

/** Write what a stroke painted into each node's `data.skin`, as one undo entry. */
function commitPainted(env: WeightEnv, deps: ActionDeps): void {
  const scene = env.scene();
  const ops: Op[] = [];
  for (const [id, skin] of env.painted()) {
    const data = scene.get(id)?.data;
    if (data !== undefined) ops.push(createSetDataOp({ id, from: data, to: { ...(data as object), skin }, label: 'Paint weights' }));
  }
  if (ops.length > 0) {
    if (deps.applyOps) deps.applyOps(ops, 'Paint weights');
    else scene.applyBatch(ops, 'Paint weights', defaultCommitAdapter(scene, deps.selection?.adapterMethods));
  }
  env.paint(null);
}

/** The weight tool's actions: `weight.paint` and `weight.click`. */
export function createWeightActions(env: WeightEnv): Action[] {
  const editing = () => (env.placed() ? true : ActionDisabledReason.NotApplicable);
  return [
    {
      id: 'weight.paint',
      label: 'Weight — paint the active joint\'s weights',
      eligible,
      requires: ['view', 'selection', 'applyOps'],
      enabled: () => (activeJoint(env) !== null ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'ongoing',
        start: ({ deps, drag, world, modifiers }: InvocationCtx) => {
          const joint = activeJoint(env);
          if (joint === null) return {};
          const stroke = (x: number, y: number, alt: boolean): void => {
            const next = dab(env, deps, joint, x, y, alt ? 'remove' : 'add');
            if (next) env.paint(next);
          };
          const press = drag?.start ?? world;
          stroke(press.x, press.y, modifiers.alt);
          return {
            onMove: (move: InvocationCtx) => stroke(move.world.x, move.world.y, move.modifiers.alt),
            // The dispatcher hands `onEnd` a context with empty deps.
            onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
              if (reason === 'cancel') env.paint(null);
              else commitPainted(env, deps);
            },
          };
        },
      },
    },
    {
      id: 'weight.click',
      label: 'Weight — pick a joint, or dab its weight',
      eligible,
      requires: ['view', 'selection', 'applyOps'],
      enabled: editing,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const p = params as ImmediateParams | undefined;
          const press = p?.press;
          const rig = env.placed();
          if (!rig || !press) return;
          const hit = jointAt(rig.skeleton, press.x, press.y, sceneReach(deps, env.reachPx()));
          if (hit !== null) {
            env.state.setActive(hit);
            return;
          }
          const joint = activeJoint(env);
          const next = joint === null ? null : dab(env, deps, joint, press.x, press.y, p?.mods?.alt ? 'remove' : 'add');
          if (!next) return;
          env.paint(next);
          commitPainted(env, deps);
        },
      },
    },
  ];
}

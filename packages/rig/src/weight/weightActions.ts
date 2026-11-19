import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import { worldCoords, type PolygonPath } from '@weasel-js/geom';
import type { Op } from '@weasel-js/history';
import { createSetDataOp } from '@weasel-js/core';
import type { NodeId, Scene } from '@weasel-js/core';
import { commitOps } from '@weasel-js/core';
import type { RigNodeData } from '@weasel-js/core';
import { jointAt } from '@weasel-js/animator';
import { toSkinPolygon, type Skin } from '@weasel-js/animator';
import { dataRestPath } from '@weasel-js/core';
import { brushWeights, jointShares, setJointWeights } from '@weasel-js/animator';
import { sceneReach, type PlacedRig } from '../bone/placedRig';
import type { RigEditState } from '../bone/rigEditState';
import { resolveParams } from '@weasel-js/routing';
import type { WeightBrushParams } from '../actionParamSchema';
import { pref, PX_UNIT } from '@weasel-js/prefs-schema';
import { brushRing } from '@weasel-js/cursor';
import { isFiniteNumber } from '@weasel-js/registry';

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
        out.push({ id, path: toSkinPolygon(rest), skin });
      }
      walk(id);
    }
  };
  walk(rig.id);
  return out;
}

const eligible = { capability: 'edits-page' } as const;

/** The brush's radius in screen px when no option gives one. */
export const DEFAULT_WEIGHT_RADIUS_PX = 24;

/** The weight brush's size: the `weight.paint` action's params, and the tool's options. */
export const WEIGHT_BRUSH_PARAMS = pref.group('Weight brush', {
  radiusPx: pref.number('Size', DEFAULT_WEIGHT_RADIUS_PX, {
    description: 'The brush radius, in screen pixels.', min: 2, max: 400, step: 1, control: 'slider', unit: PX_UNIT,
  }),
}, { description: 'The size of the weight brush.' });

/** The weight tool's options: its brush size, stepped by `[` `]` and Shift+wheel, which a drag and a click's dab
 *  both read. */
export const WEIGHT_TOOL_OPTIONS = {
  actionId: ['weight.paint', 'weight.dab'],
  prefs: WEIGHT_BRUSH_PARAMS,
  size: { option: 'radiusPx', times: 1.25 },
} as const;

const radiusOf = (params: Readonly<WeightBrushParams> | undefined): number => {
  const r = params?.radiusPx;
  return isFiniteNumber(r) && r > 0 ? r : DEFAULT_WEIGHT_RADIUS_PX;
};

const activeJoint = (env: WeightEnv): string | null => {
  const name = env.state.active();
  return name !== null && env.placed()?.skeleton.joints.some((j) => j.name === name) ? name : null;
};

/** One dab of the brush at `(x, y)`: what `env.painted()` becomes, or `null` if no point moved. */
function dab(
  env: WeightEnv, deps: ActionDeps, joint: string, x: number, y: number, mode: 'add' | 'remove', radiusPx: number,
): Map<NodeId, Skin> | null {
  const radius = sceneReach(deps, radiusPx);
  let next: Map<NodeId, Skin> | null = null;
  for (const { id, path, skin } of weighedPaths(env)) {
    const count = path.coords.length >> 1;
    const hits = brushWeights(worldCoords(path), x, y, radius, jointShares(skin, joint, count), mode);
    if (hits.size === 0) continue;
    next ??= new Map(env.painted());
    next.set(id, setJointWeights(skin, count, joint, hits));
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
  commitOps({ ...deps, scene }, ops, 'Paint weights');
  env.paint(null);
}

/** The weight tool's actions: `weight.paint` and `weight.dab`. */
export function createWeightActions(env: WeightEnv): Action[] {
  const editing = () => (env.placed() ? true : ActionDisabledReason.NotApplicable);
  return [
    defineAction({
      id: 'weight.paint',
      label: 'Weight — paint the active joint\'s weights',
      eligible,
      requires: ['view', 'operands', 'applyOps'],
      params: WEIGHT_BRUSH_PARAMS,
      cursor: (params) => brushRing(radiusOf(params)),
      enabled: () => (activeJoint(env) !== null ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'ongoing',
        start: ({ deps, drag, world, modifiers }, opts) => {
          const joint = activeJoint(env);
          if (joint === null) return {};
          let radiusPx = radiusOf(resolveParams(opts?.params));
          const stroke = (x: number, y: number, alt: boolean): void => {
            const next = dab(env, deps, joint, x, y, alt ? 'remove' : 'add', radiusPx);
            if (next) env.paint(next);
          };
          const press = drag?.start ?? world;
          stroke(press.x, press.y, modifiers.alt);
          return {
            cursor: () => brushRing(radiusPx),
            onMove: (move: InvocationCtx) => {
              radiusPx = radiusOf({ ...resolveParams(opts?.params), ...move.params });
              stroke(move.world.x, move.world.y, move.modifiers.alt);
            },
            // The dispatcher hands `onEnd` a context with empty deps.
            onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
              if (reason === 'cancel') env.paint(null);
              else commitPainted(env, deps);
            },
          };
        },
      },
    }),
    defineAction({
      id: 'weight.dab',
      label: 'Weight — pick a joint, or dab its weight',
      eligible,
      requires: ['view', 'operands', 'applyOps'],
      enabled: editing,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const press = params?.press;
          const rig = env.placed();
          if (!rig || !press) return;
          const hit = jointAt(rig.skeleton, press.x, press.y, sceneReach(deps, env.reachPx()));
          if (hit !== null) {
            env.state.setActive(hit);
            return;
          }
          const joint = activeJoint(env);
          const next = joint === null ? null : dab(env, deps, joint, press.x, press.y, params?.mods?.alt ? 'remove' : 'add', radiusOf(params));
          if (!next) return;
          env.paint(next);
          commitPainted(env, deps);
        },
      },
    }),
  ];
}

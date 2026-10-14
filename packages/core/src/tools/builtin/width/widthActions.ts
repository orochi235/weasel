import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { WidthProfile } from '@weasel-js/paint';
import { createSetDataOp } from 'core/ops/setData';
import type { Scene } from 'core/scene/types';
import { commitOps } from 'interactions/actions/pathCommands/pathNodes';
import { sceneReach } from '../bone/placedRig';
import {
  dataWithProfile, grabbedT, profileDraggedTo, profileWithout, stopIndexNear, widthHitAt, type WidthTarget,
} from './widthEdit';

type AnyScene = Scene<unknown, string, unknown>;

/** What the width tool's overlay shows: the stroke last pressed on, and
 *  the profile it is being dragged to while a drag runs. */
export interface WidthFocus {
  target: WidthTarget;
  /** The profile showing, live during a drag. */
  profile: WidthProfile;
}

/** The width tool's own state, shared by its actions and its overlay. */
export interface WidthEnv {
  focus(): WidthFocus | null;
  setFocus(next: WidthFocus | null): void;
  /** Screen px around a stroke's ink within which a press takes it, and
   *  around a stop within which a press takes hold of that stop. */
  reachPx(): number;
}

/** Drag on a stroke to set its width there, adding a stop or moving the nearest one. */
export const WIDTH_DRAG_ID = 'width.drag';
/** Alt-click a width stop to remove it. */
export const WIDTH_REMOVE_STOP_ID = 'width.removeStop';
const LABEL = 'Stroke width';

const meanScale = (deps: ActionDeps): number => {
  const s = deps.view?.get().scale ?? { x: 1, y: 1 };
  return (Math.abs(s.x) + Math.abs(s.y)) / 2;
};

function hitAt(deps: ActionDeps, env: WidthEnv, x: number, y: number) {
  const scene = deps.scene as AnyScene | undefined;
  if (!scene) return null;
  const reach = sceneReach(deps, env.reachPx());
  const hit = widthHitAt(scene, x, y, meanScale(deps), reach);
  return hit && { ...hit, reach };
}

function commit(deps: ActionDeps, target: WidthTarget, profile: WidthProfile | undefined): void {
  const to = dataWithProfile(target, profile);
  commitOps(deps, [createSetDataOp({ id: target.id, from: target.node.data, to, label: LABEL })], LABEL);
}

/**
 * The width tool's actions. `width.drag` takes hold of the stroke under the
 * press, at the stop there or a new one, and sets the stroke's width at that
 * point to twice the pointer's distance from the centerline, live, as one
 * undo entry. `width.removeStop` removes the stop under a click.
 */
export function createWidthActions(env: WidthEnv): Action[] {
  const eligible = { capability: 'edits-page' } as const;
  const hasScene = (deps?: ActionDeps) => (deps?.scene ? true : ActionDisabledReason.NotApplicable);
  return [
    {
      id: WIDTH_DRAG_ID,
      label: 'Width — drag a stroke\'s width at a point',
      eligible,
      requires: ['scene', 'view'],
      enabled: hasScene,
      invoker: {
        timing: 'ongoing',
        start: ({ deps, drag, world }: InvocationCtx) => {
          const press = drag?.start ?? world;
          const hit = hitAt(deps, env, press.x, press.y);
          if (!hit) return {};
          const { target, site, reach } = hit;
          const t = grabbedT(target.stroke.widthProfile ?? [], site, reach);
          let profile: WidthProfile | null = null;
          env.setFocus({ target, profile: target.stroke.widthProfile ?? [] });
          return {
            kind: WIDTH_DRAG_ID,
            onMove: (move: InvocationCtx) => {
              profile = profileDraggedTo(target, site.subpath, t, move.drag?.current ?? move.world);
              env.setFocus({ target, profile });
            },
            // The dispatcher hands `onEnd` a context with empty deps.
            onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
              const done = profile;
              profile = null;
              if (reason === 'cancel' || done === null) {
                env.setFocus({ target, profile: target.stroke.widthProfile ?? [] });
                return;
              }
              commit(deps, target, done);
              env.setFocus({ target: { ...target, stroke: { ...target.stroke, widthProfile: done } }, profile: done });
            },
            previewIds: () => (profile ? [target.id] : null),
            previewData: (id: string) => (profile && id === target.id ? dataWithProfile(target, profile) : null),
          };
        },
      },
    },
    {
      id: WIDTH_REMOVE_STOP_ID,
      label: 'Width — remove the stop under the pointer',
      eligible,
      requires: ['scene', 'view'],
      enabled: hasScene,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const p = params as { pressX?: number; pressY?: number } | undefined;
          if (p?.pressX === undefined || p.pressY === undefined) return;
          const hit = hitAt(deps, env, p.pressX, p.pressY);
          const profile = hit?.target.stroke.widthProfile;
          if (!hit || !profile) return;
          const index = stopIndexNear(profile, hit.site, hit.reach);
          if (index < 0) return;
          const next = profileWithout(profile, index);
          commit(deps, hit.target, next);
          env.setFocus({ target: hit.target, profile: next ?? [] });
        },
      },
    },
  ];
}

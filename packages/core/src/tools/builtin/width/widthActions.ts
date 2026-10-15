import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import { createSetDataOp } from 'core/ops/setData';
import { createTransformOp } from 'core/ops/transform';
import type { Scene } from 'core/scene/types';
import { commitOps } from 'interactions/actions/pathCommands/pathNodes';
import { sceneReach } from '../bone/placedRig';
import { anchorNear, gripAt, storedWith, widthsOf, widthTargetAt, type WidthGrip } from './widthEdit';

type AnyScene = Scene<unknown, string, unknown>;

/** What the width tool's overlay shows: the anchors of the stroke last
 *  pressed on, in world space, with their widths (`NaN` for none). */
export interface WidthFocus {
  anchors: readonly { x: number; y: number }[];
  widths: readonly number[];
}

/** The width tool's own state, shared by its actions and its overlay. */
export interface WidthEnv {
  focus(): WidthFocus | null;
  setFocus(next: WidthFocus | null): void;
  /** Screen px around a stroke's ink within which a press takes it, and
   *  around an anchor within which a press takes hold of that anchor. */
  reachPx(): number;
}

export const WIDTH_DRAG_ID = 'width.drag';
export const WIDTH_CLEAR_ID = 'width.clear';
const LABEL = 'Stroke width';
const REQUIRES = ['scene', 'view', 'selection', 'applyOps'] as const;

const meanScale = (deps: ActionDeps): number => {
  const s = deps.view?.get().scale ?? { x: 1, y: 1 };
  return (Math.abs(s.x) + Math.abs(s.y)) / 2;
};

function targetAt(deps: ActionDeps, env: WidthEnv, x: number, y: number) {
  const scene = deps.scene as AnyScene | undefined;
  if (!scene) return null;
  const reach = sceneReach(deps, env.reachPx());
  const target = widthTargetAt(scene, x, y, meanScale(deps), reach);
  return target && { target, reach };
}

const focusOf = (path: PolygonPath, widths: readonly number[]): WidthFocus => ({
  anchors: pathToAnchors(path).anchors.flat().map((a) => ({ x: a.x, y: a.y })),
  widths,
});

function commit(deps: ActionDeps, grip: WidthGrip, widths: readonly number[]): void {
  const next = storedWith(grip, widths);
  if (!next) return;
  const { id, node } = grip.target;
  const ops: Op[] = [];
  if (next.pose !== node.pose) ops.push(createTransformOp({ id, from: node.pose, to: next.pose, label: LABEL }));
  ops.push(createSetDataOp({ id, from: node.data, to: next.data, label: LABEL }));
  commitOps(deps, ops, LABEL);
}

/**
 * The width tool's actions, which write a stroke's `vertexWidths`.
 * `width.drag` takes hold of the anchor under the press — inserting one,
 * shape and all kept, where the press falls between two — and sets its width
 * to twice the pointer's distance from it, live, as one undo entry.
 * `width.clear` clears the width of the anchor under a click, so it takes the
 * stroke's own again.
 */
export function createWidthActions(env: WidthEnv): Action[] {
  const eligible = { capability: 'edits-page' } as const;
  const hasScene = (deps?: ActionDeps) => (deps?.scene ? true : ActionDisabledReason.NotApplicable);
  return [
    {
      id: WIDTH_DRAG_ID,
      label: 'Width — drag a stroke\'s width at an anchor',
      eligible,
      requires: REQUIRES,
      enabled: hasScene,
      invoker: {
        timing: 'ongoing',
        start: ({ deps, drag, world }: InvocationCtx) => {
          const press = drag?.start ?? world;
          const hit = targetAt(deps, env, press.x, press.y);
          const grip = hit && gripAt(hit.target, press.x, press.y, hit.reach);
          if (!grip) return {};
          let widths: number[] | null = null;
          let preview: { pose: unknown; data: unknown } | null = null;
          env.setFocus(focusOf(grip.target.path, widthsOf(grip.target, grip.widths.length - (grip.inserted ? 1 : 0))));
          return {
            kind: WIDTH_DRAG_ID,
            onMove: (move: InvocationCtx) => {
              const p = move.drag?.current ?? move.world;
              widths = [...grip.widths];
              widths[grip.index] = 2 * Math.hypot(p.x - grip.at.x, p.y - grip.at.y);
              preview = storedWith(grip, widths);
              env.setFocus(focusOf(grip.path, widths));
            },
            // The dispatcher hands `onEnd` a context with empty deps.
            onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
              const done = widths;
              widths = null;
              preview = null;
              if (reason === 'cancel' || done === null) {
                env.setFocus(focusOf(grip.target.path, widthsOf(grip.target, grip.widths.length - (grip.inserted ? 1 : 0))));
                return;
              }
              commit(deps, grip, done);
            },
            previewIds: () => (preview ? [grip.target.id] : null),
            previewPose: (id: string) => (preview && id === grip.target.id ? preview.pose : null),
            previewData: (id: string) => (preview && id === grip.target.id ? preview.data : null),
          };
        },
      },
    },
    {
      id: WIDTH_CLEAR_ID,
      label: 'Width — clear the width of the anchor under the pointer',
      eligible,
      requires: REQUIRES,
      enabled: hasScene,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const p = params as { pressX?: number; pressY?: number } | undefined;
          if (p?.pressX === undefined || p.pressY === undefined) return;
          const hit = targetAt(deps, env, p.pressX, p.pressY);
          if (!hit) return;
          const index = anchorNear(hit.target.path, p.pressX, p.pressY, hit.reach);
          const count = pathToAnchors(hit.target.path).anchors.flat().length;
          const widths = widthsOf(hit.target, count);
          if (index < 0 || Number.isNaN(widths[index])) return;
          widths[index] = NaN;
          const grip: WidthGrip = { target: hit.target, path: hit.target.path, widths, index, at: { x: 0, y: 0 }, inserted: false };
          commit(deps, grip, widths);
          env.setFocus(focusOf(hit.target.path, widths));
        },
      },
    },
  ];
}

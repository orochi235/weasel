import type { Action, ActionDeps, BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason, resolveParams } from '@weasel-js/routing';
import { pref } from '@weasel-js/prefs';
import { meanScale, pathToAnchors, pxExtent, type PolygonPath, type Point } from '@weasel-js/geom';
import type { VertexWidth } from '@weasel-js/paint';
import { commitOps, reshapeTo, type Scene } from '@weasel-js/core';
import {
  anchorNormals, draggedWidth, gripAt, isWidthSet, movedSide, storedWith, widthEdgeAt, widthPointNear, widthsOf,
  widthTargetAt, type WidthGrip, type WidthTarget,
} from './widthEdit';
import type { ImmediateParams } from '@weasel-js/routing';

type AnyScene = Scene<unknown, string, unknown>;

/** What the Girth tool's overlay shows, in world space: the anchors of the
 *  stroke last hovered or pressed on, each with its unit normal toward its
 *  right edge and its `vertexWidths` entry (`NaN` for none), and, over an
 *  edge, the grab point on it and the width point a press there moves. */
export interface GirthFocus {
  anchors: readonly Point[];
  normals: readonly Point[];
  widths: readonly VertexWidth[];
  /** The stroke's own width, which an unset entry takes. */
  fallback: number;
  grab?: { edge: Point; at: Point };
}

/** The Girth tool's own state, shared by its actions and its overlay. */
export interface GirthEnv {
  focus(): GirthFocus | null;
  setFocus(next: GirthFocus | null): void;
  /** Screen px around a stroke's edge within which a press takes hold of it,
   *  and along the path within which it takes the anchor there. */
  reachPx(): number;
}

/** What `girth.drag` reads from its params. */
export interface GirthDragParams {
  /** Screen px around a stroke's edge within which a press takes hold of it, and along the path within which it
   *  takes the anchor there rather than inserting one. Default: the tool's `reach`. */
  reach?: number;
  /** Move only the grabbed edge, writing a `{ left, right }` pair; Alt flips it. Default `false`. */
  oneSided?: boolean;
}

/** Default {@link GirthDragParams.reach}. */
export const DEFAULT_GIRTH_REACH_PX = 6;

/** A Girth drag's params as a form, for the last-operation panel. */
export const GIRTH_DRAG_PARAMS = pref.group('Stroke width', {
  reach: pref.number('Grab reach', DEFAULT_GIRTH_REACH_PX, {
    description: 'How near the edge, and how near an anchor along the path, a press has to land to take the anchor there rather than add a width point.',
    min: 1, max: 30, step: 1, control: 'slider', unit: { scale: 1, suffix: 'px' },
  }),
  oneSided: pref.boolean('One edge only', false, { description: 'Move only the edge you dragged, leaving the other where it was. Alt during the drag flips it.' }),
});

/** Id of the action that drags a stroke's edge. */
export const GIRTH_DRAG_ID = 'girth.drag';
/** Id of the action that clears the width point under a click. */
export const GIRTH_CLEAR_ID = 'girth.clear';
/** Id of the action that marks the edge under a hover. */
export const GIRTH_HOVER_ID = 'girth.hover';
/** Id of the action that drops the hover mark when the pointer leaves. */
export const GIRTH_UNHOVER_ID = 'girth.unhover';
const LABEL = 'Stroke width';
const REQUIRES = ['scene', 'view', 'selection', 'applyOps'] as const;

const found = (deps: ActionDeps, env: GirthEnv, reachPx = env.reachPx()) => {
  const scene = deps.scene as AnyScene | undefined;
  if (!scene) return null;
  const s = deps.view?.get().scale ?? { x: 1, y: 1 };
  const e = pxExtent(reachPx, s);
  return { scene, scale: meanScale(s), reach: Math.max(e.x, e.y) };
};

const focusOf = (path: PolygonPath, widths: readonly VertexWidth[], fallback: number, grab?: GirthFocus['grab']): GirthFocus => ({
  anchors: pathToAnchors(path).anchors.flat().map((a) => ({ x: a.x, y: a.y })),
  normals: anchorNormals(path),
  widths,
  fallback,
  ...(grab ? { grab } : {}),
});

const restingFocus = (target: WidthTarget): GirthFocus =>
  focusOf(target.path, widthsOf(target, pathToAnchors(target.path).anchors.flat().length), target.fallback);

/** The focus as it was, less its grab point. */
function dropGrab(env: GirthEnv): void {
  const last = env.focus();
  if (!last?.grab) return;
  const { grab: _grab, ...rest } = last;
  void _grab;
  env.setFocus(rest);
}

function commit(deps: ActionDeps, grip: WidthGrip, widths: readonly VertexWidth[]): void {
  const next = storedWith(grip, widths);
  if (next) commitOps(deps, reshapeTo(grip.target.node, next, LABEL), LABEL);
}

const edgeOf = (grip: WidthGrip, moved: number): Point => ({
  x: grip.at.x + grip.normal.x * moved * grip.factor,
  y: grip.at.y + grip.normal.y * moved * grip.factor,
});

const reachOf = (params: GirthDragParams | undefined, env: GirthEnv): number =>
  typeof params?.reach === 'number' && params.reach > 0 ? params.reach : env.reachPx();

/** The grip a press at `press` takes with `params`, read against the scene and view as they are now. */
function gripFor(deps: ActionDeps, env: GirthEnv, press: Point, params: GirthDragParams | undefined): WidthGrip | null {
  const at = found(deps, env, reachOf(params, env));
  const hit = at && widthEdgeAt(at.scene, press.x, press.y, at.scale, at.reach);
  return hit ? gripAt(hit) : null;
}

/** The widths `grip` leaves with the pointer at `p`, one-sided when `params` says so, Alt flipping that. */
function widthsAt(grip: WidthGrip, press: Point, p: Point, alt: boolean, params: GirthDragParams | undefined) {
  const moved = movedSide(grip, (p.x - press.x) * grip.normal.x + (p.y - press.y) * grip.normal.y);
  const widths = [...grip.widths];
  widths[grip.index] = draggedWidth(grip, moved, (params?.oneSided === true) !== alt);
  return { widths, moved };
}

function dragAction(env: GirthEnv): Action['invoker'] {
  return {
    timing: 'ongoing',
    start: ({ deps, drag, world }: InvocationCtx, opts?: BindingOpts) => {
      const press = drag?.start ?? world;
      const read = () => resolveParams(opts?.params) as GirthDragParams | undefined;
      const grip = gripFor(deps, env, press, read());
      if (!grip) return {};
      const { fallback } = grip.target;
      let widths: VertexWidth[] | null = null;
      let preview: { pose: unknown; data: unknown } | null = null;
      let last: { p: Point; alt: boolean } | null = null;
      env.setFocus(focusOf(grip.path, grip.widths, fallback, { edge: edgeOf(grip, grip.start[grip.side]), at: grip.at }));
      return {
        kind: GIRTH_DRAG_ID,
        onMove: (move: InvocationCtx) => {
          const p = move.drag?.current ?? move.world;
          last = { p, alt: move.modifiers.alt };
          const next = widthsAt(grip, press, p, move.modifiers.alt, read());
          widths = next.widths;
          preview = storedWith(grip, widths);
          env.setFocus(focusOf(grip.path, widths, fallback, { edge: edgeOf(grip, next.moved), at: grip.at }));
        },
        // The dispatcher hands `onEnd` a context with empty deps.
        onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
          const done = widths;
          widths = null;
          preview = null;
          if (reason === 'cancel' || done === null) {
            env.setFocus(restingFocus(grip.target));
            return;
          }
          commit(deps, grip, done);
          env.setFocus(focusOf(grip.path, done, fallback));
        },
        replay: (params: Record<string, unknown>) => {
          const again = last && gripFor(deps, env, press, params);
          if (!last || !again) return;
          const { widths: done } = widthsAt(again, press, last.p, last.alt, params);
          commit(deps, again, done);
          env.setFocus(focusOf(again.path, done, again.target.fallback));
        },
        previewIds: () => (preview ? [grip.target.id] : null),
        previewPose: (id: string) => (preview && id === grip.target.id ? preview.pose : null),
        previewData: (id: string) => (preview && id === grip.target.id ? preview.data : null),
      };
    },
  };
}

/**
 * The Girth tool's actions, which write a stroke's `vertexWidths`.
 * `girth.drag` takes hold of the stroke edge under the press, at the anchor
 * there or at one it inserts, shape kept, between two. The edge follows the
 * pointer along the path's normal, the other edge mirroring it so the width
 * stays centered; with Alt held only the grabbed edge moves, which writes a
 * `{ left, right }` pair (the `oneSided` param flips which, {@link GirthDragParams}).
 * Either is live, and one undo entry, which the last-operation panel replays
 * with other params. `girth.clear`
 * clears the width point under a click, so it takes the stroke's own width
 * again. `girth.hover` and `girth.unhover` show and hide the grab point under
 * the pointer.
 */
export function createGirthActions(env: GirthEnv): Action[] {
  const eligible = { capability: 'edits-page' } as const;
  const hasScene = (deps?: ActionDeps) => (deps?.scene ? true : ActionDisabledReason.NotApplicable);
  const base = { eligible, requires: REQUIRES, enabled: hasScene };
  return [
    { id: GIRTH_DRAG_ID, label: LABEL, ...base, params: GIRTH_DRAG_PARAMS, invoker: dragAction(env) },
    {
      id: GIRTH_CLEAR_ID,
      label: 'Girth — clear the width point under the pointer',
      ...base,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const press = (params as ImmediateParams | undefined)?.press;
          const at = found(deps, env);
          if (!at || !press) return;
          const target = widthTargetAt(at.scene, press.x, press.y, at.scale, at.reach);
          if (!target) return;
          const index = widthPointNear(target, press.x, press.y, at.reach);
          const widths = widthsOf(target, pathToAnchors(target.path).anchors.flat().length);
          if (index < 0 || !isWidthSet(widths[index])) return;
          widths[index] = NaN;
          const grip: WidthGrip = {
            target, path: target.path, widths, index, at: { x: 0, y: 0 }, inserted: false,
            side: 'right', normal: { x: 0, y: 1 }, start: { left: 0, right: 0 }, factor: 1,
          };
          commit(deps, grip, widths);
          env.setFocus(focusOf(target.path, widths, target.fallback));
        },
      },
    },
    {
      id: GIRTH_HOVER_ID,
      label: 'Girth — show the stroke edge under the pointer',
      ...base,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const world = (params as ImmediateParams | undefined)?.world;
          const at = found(deps, env);
          if (!at || !world) return;
          const hit = widthEdgeAt(at.scene, world.x, world.y, at.scale, at.reach);
          if (!hit) {
            dropGrab(env);
            return;
          }
          const { edge } = hit;
          const half = edge.side === 'right' ? edge.right : edge.left;
          env.setFocus({
            ...restingFocus(hit.target),
            grab: { edge: { x: edge.x + edge.nx * half, y: edge.y + edge.ny * half }, at: hit.at },
          });
        },
      },
    },
    {
      id: GIRTH_UNHOVER_ID,
      label: 'Girth — hide the grab point',
      ...base,
      invoker: {
        timing: 'immediate',
        run: () => dropGrab(env),
      },
    },
  ];
}

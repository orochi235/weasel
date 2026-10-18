import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { meanScale, pathToAnchors, pxExtent, type PolygonPath, type Point } from '@weasel-js/geom';
import type { VertexWidth } from '@weasel-js/paint';
import { commitOps, reshapeTo, type Scene } from '@weasel-js/core';
import {
  anchorNormals, draggedWidth, gripAt, isWidthSet, movedSide, storedWith, widthEdgeAt, widthPointNear, widthsOf,
  widthTargetAt, type WidthGrip, type WidthTarget,
} from './widthEdit';

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

const found = (deps: ActionDeps, env: GirthEnv) => {
  const scene = deps.scene as AnyScene | undefined;
  if (!scene) return null;
  const s = deps.view?.get().scale ?? { x: 1, y: 1 };
  const e = pxExtent(env.reachPx(), s);
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

function dragAction(env: GirthEnv): Action['invoker'] {
  return {
    timing: 'ongoing',
    start: ({ deps, drag, world }: InvocationCtx) => {
      const press = drag?.start ?? world;
      const at = found(deps, env);
      const hit = at && widthEdgeAt(at.scene, press.x, press.y, at.scale, at.reach);
      const grip = hit && gripAt(hit);
      if (!grip) return {};
      const { fallback } = grip.target;
      let widths: VertexWidth[] | null = null;
      let preview: { pose: unknown; data: unknown } | null = null;
      env.setFocus(focusOf(grip.path, grip.widths, fallback, { edge: edgeOf(grip, grip.start[grip.side]), at: grip.at }));
      return {
        kind: GIRTH_DRAG_ID,
        onMove: (move: InvocationCtx) => {
          const p = move.drag?.current ?? move.world;
          const moved = movedSide(grip, (p.x - press.x) * grip.normal.x + (p.y - press.y) * grip.normal.y);
          widths = [...grip.widths];
          widths[grip.index] = draggedWidth(grip, moved, move.modifiers.alt);
          preview = storedWith(grip, widths);
          env.setFocus(focusOf(grip.path, widths, fallback, { edge: edgeOf(grip, moved), at: grip.at }));
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
 * `{ left, right }` pair. Either is live, and one undo entry. `girth.clear`
 * clears the width point under a click, so it takes the stroke's own width
 * again. `girth.hover` and `girth.unhover` show and hide the grab point under
 * the pointer.
 */
export function createGirthActions(env: GirthEnv): Action[] {
  const eligible = { capability: 'edits-page' } as const;
  const hasScene = (deps?: ActionDeps) => (deps?.scene ? true : ActionDisabledReason.NotApplicable);
  const base = { eligible, requires: REQUIRES, enabled: hasScene };
  return [
    { id: GIRTH_DRAG_ID, label: 'Girth — drag a stroke\'s edge', ...base, invoker: dragAction(env) },
    {
      id: GIRTH_CLEAR_ID,
      label: 'Girth — clear the width point under the pointer',
      ...base,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const p = params as { pressX?: number; pressY?: number } | undefined;
          const at = found(deps, env);
          if (!at || p?.pressX === undefined || p.pressY === undefined) return;
          const target = widthTargetAt(at.scene, p.pressX, p.pressY, at.scale, at.reach);
          if (!target) return;
          const index = widthPointNear(target, p.pressX, p.pressY, at.reach);
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
          const p = params as { worldX?: number; worldY?: number } | undefined;
          const at = found(deps, env);
          if (!at || p?.worldX === undefined || p.worldY === undefined) return;
          const hit = widthEdgeAt(at.scene, p.worldX, p.worldY, at.scale, at.reach);
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

/**
 * `brushDeleteAnchorsAction` — Alt-drag in path edit to brush anchors away.
 * Every anchor the round brush passes over is deleted, and each gap is refit
 * to the shape it replaces by `deleteAnchorsAt`, the same edit the Delete key
 * makes. The path previews without them while the brush is down and commits
 * as one undo step on release.
 *
 * Bound with no target, so an Alt-press on an anchor, a segment, or empty
 * canvas all start a stroke. Alt-click stays `insertPathAnchor`'s: a click
 * never crosses the drag threshold.
 */

import type { Action, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason, resolveParams } from '@weasel-js/routing';
import {
  anchorsUnderBrush, deleteAnchorsAt, editAnchorSetTracked, pathToAnchors,
  type AnchorSet, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { pathEditPreview } from '../edit-anchors/preview';
import { depOf } from './anchorEditing';

/** The brush's radius on screen when the binding names none. */
export const BRUSH_DELETE_RADIUS_PX = 12;

/** Binding params the brush reads on every move, so a thunk can resize it
 *  mid-stroke. */
export interface BrushDeleteAnchorsParams {
  /** Brush radius in screen pixels. */
  radiusPx?: number;
}

type Point = { x: number; y: number };

export const brushDeleteAnchorsAction: Action & { requires: string[] } = inPlane({
  id: 'brushDeleteAnchors',
  label: 'Brush delete anchors',
  defaultBinding: { kind: 'drag', mods: { alt: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts): OngoingHandle {
      const dep = depOf(ctx.deps);
      if (!dep) return {};
      const id = dep.editingId;
      const origin = dep.getEditablePath(id) as PolygonPath | undefined;
      if (!origin || origin.kind !== 'polygon') return {};
      const originSet = pathToAnchors(origin) as AnchorSet;

      const radiusPx = (): number => {
        const r = (resolveParams(opts?.params) as BrushDeleteAnchorsParams | undefined)?.radiusPx;
        return typeof r === 'number' && r > 0 ? r : BRUSH_DELETE_RADIUS_PX;
      };
      const scale = () => ctx.deps.view?.get().scale;
      const trail: Point[] = [];
      const doomed = new Set<number>();
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;

      const sweepTo = (p: Point): void => {
        const from = trail[trail.length - 1] ?? p;
        trail.push({ x: p.x, y: p.y });
        const before = doomed.size;
        for (const i of anchorsUnderBrush(originSet, from, p, { radiusPx: radiusPx(), scale: scale() })) {
          doomed.add(i);
        }
        if (doomed.size === before) return;
        // A sweep that would leave no subpath is refused whole; keep the last
        // deletion that stood.
        current = editAnchorSetTracked(origin, (set) => deleteAnchorsAt(set, doomed)) ?? current;
      };

      const preview = pathEditPreview(dep, id, () => current?.path ?? null);
      if (!preview) return {};
      sweepTo(ctx.world);

      return {
        kind: 'brush-delete-anchors',
        onMove(moveCtx: InvocationCtx): void {
          sweepTo(moveCtx.world);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const done = current;
          current = null;
          if (reason === 'cancel' || !done) return;
          dep.applyEdit(id, done.path, 'Brush delete anchors', done.origins);
          // Deleting renumbers the anchors after the first one removed.
          dep.setSelectedAnchors([]);
        },
        overlay: () => ({ kind: 'brush', points: trail.slice(), radiusPx: radiusPx() }),
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: (deps) => (depOf(deps) ? true : ActionDisabledReason.NotApplicable),
}, editingLayer);

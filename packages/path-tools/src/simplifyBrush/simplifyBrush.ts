import {
  type Action, ActionDisabledReason, type InvocationCtx, type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import { pref } from '@weasel-js/prefs';
import {
  anchorsUnderBrush, editAnchorSetTracked, pathToAnchors, simplifyAnchorsAt,
  type AnchorSet, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import {
  DEFAULT_SIMPLIFY_TOLERANCE, depOf, editingLayer, inPlane, pathEditPreview, pathOperationTags,
} from '@weasel-js/core';

/** The brush's radius on screen when no param names one. */
export const SIMPLIFY_BRUSH_RADIUS_PX = 12;

const LABEL = 'Simplify brush';

/** The brush's size and tolerance as a form: the last-operation panel's after a stroke, and the tool's options
 *  (`SIMPLIFY_BRUSH_OPTIONS`), which are one setting. */
export const SIMPLIFY_BRUSH_PARAMS = pref.group(LABEL, {
  radiusPx: pref.number('Size', SIMPLIFY_BRUSH_RADIUS_PX, {
    description: 'The brush radius, in screen pixels.', min: 2, max: 400, step: 1, control: 'slider',
  }),
  tolerance: pref.number('Tolerance', DEFAULT_SIMPLIFY_TOLERANCE, {
    description: 'How far the refit outline may stray from the anchors it replaces.', min: 0.1, max: 20, step: 0.1, control: 'slider',
  }),
}, { description: 'The size of the Simplify brush and how far its refit may stray.' });

/** Params the brush reads on every move, so a thunk can change them mid-stroke. */
export interface SimplifyBrushParams {
  /** Brush radius in screen pixels. */
  radiusPx?: number;
  /** How far the refit may stray from the original, in world units, as for
   *  the Simplify command. */
  tolerance?: number;
}

/** The kit's brush-ring cursor drawn `radiusPx` in radius on screen. */
export function brushRingCursor(radiusPx: number): CursorSpec {
  // The `brush` glyph's ring is 9.9 units in radius on a 24-unit box.
  return { glyph: 'brush', size: Math.round((radiusPx * 24) / 9.9), fallback: 'crosshair' };
}

type Point = { x: number; y: number };

/** A point the brush passed, and the view's scale when it did. */
interface Sample {
  at: Point;
  scale: { x: number; y: number } | undefined;
}

/** Add to `gathered` every anchor of `set` the brush covers sweeping from `from` to `to`. */
function gatherSpan(set: AnchorSet, gathered: Set<number>, from: Point, to: Sample, radiusPx: number): void {
  for (const i of anchorsUnderBrush(set, from, to.at, { radiusPx, scale: to.scale })) gathered.add(i);
}

function radiusOf(params: SimplifyBrushParams | undefined): number {
  const r = params?.radiusPx;
  return typeof r === 'number' && r > 0 ? r : SIMPLIFY_BRUSH_RADIUS_PX;
}

function toleranceOf(params: SimplifyBrushParams | undefined): number {
  const t = params?.tolerance;
  return typeof t === 'number' && t >= 0 ? t : DEFAULT_SIMPLIFY_TOLERANCE;
}

/**
 * The Simplify command, brushed on. A drag in path edit gathers every anchor a
 * round brush passes over, and each unbroken stretch of them along a subpath
 * is refitted as one span by Simplify's own fitter (`simplifyAnchorsAt`) at
 * `tolerance`.
 * Only anchors the shape does not need go, so brushing again goes further.
 * The path previews the result while the brush is down and commits as one
 * undo step on release, which the last-operation panel replays from the
 * brush's samples with another Size or Tolerance. It has no binding of its own: `useSimplifyBrushTool`
 * binds it.
 */
export const simplifyBrushAction: Action & { requires: string[] } = inPlane({
  id: 'simplifyBrush',
  label: LABEL,
  tags: pathOperationTags('brush'),
  cursor: (params) => brushRingCursor(radiusOf(params as SimplifyBrushParams | undefined)),
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view'],
  params: SIMPLIFY_BRUSH_PARAMS,
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts): OngoingHandle {
      const dep = depOf(ctx.deps);
      if (!dep) return {};
      const id = dep.editingId;
      const origin = dep.getEditablePath(id) as PolygonPath | undefined;
      if (!origin || origin.kind !== 'polygon') return {};
      const originSet = pathToAnchors(origin) as AnchorSet;

      const params = () => resolveParams(opts?.params) as SimplifyBrushParams | undefined;
      const radiusPx = (): number => radiusOf(params());
      // Every sample, with the view's scale as it was taken, for a replay at another size.
      const trail: Sample[] = [];
      const gathered = new Set<number>();
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;

      const sweepTo = (p: Point): void => {
        const sample = { at: { x: p.x, y: p.y }, scale: ctx.deps.view?.get().scale };
        const from = trail.at(-1)?.at ?? sample.at;
        trail.push(sample);
        const before = gathered.size;
        gatherSpan(originSet, gathered, from, sample, radiusPx());
        if (gathered.size === before) return;
        current = editAnchorSetTracked(origin, (set) => simplifyAnchorsAt(set, gathered, toleranceOf(params())));
      };
      const commit = (anchors: ReadonlySet<number>, tolerance: number): void => {
        const done = anchors.size > 0 ? editAnchorSetTracked(origin, (set) => simplifyAnchorsAt(set, anchors, tolerance)) : null;
        if (!done) return;
        dep.applyEdit(id, done.path, LABEL, done.origins);
        // Thinning renumbers every anchor after the first one removed.
        dep.setSelectedAnchors([]);
      };

      const preview = pathEditPreview(dep, id, () => current);
      if (!preview) return {};
      sweepTo(ctx.world);

      return {
        kind: 'simplify-brush',
        cursor: () => brushRingCursor(radiusPx()),
        onMove(moveCtx: InvocationCtx): void {
          sweepTo(moveCtx.world);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          current = null;
          // The tolerance as it stands at release decides the commit.
          if (reason === 'commit') commit(gathered, toleranceOf(params()));
        },
        replay(replayed: Record<string, unknown>): void {
          const p = replayed as SimplifyBrushParams;
          const again = new Set<number>();
          trail.forEach((sample, i) => gatherSpan(originSet, again, (trail[i - 1] ?? sample).at, sample, radiusOf(p)));
          commit(again, toleranceOf(p));
        },
        overlay: () => ({ kind: 'brush', points: trail.map((s) => s.at), radiusPx: radiusPx() }),
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: (deps) => (depOf(deps) ? true : ActionDisabledReason.NotApplicable),
}, editingLayer);

import {
  type Action, ActionDisabledReason, type InvocationCtx, type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import {
  anchorsUnderBrush, editAnchorSetTracked, pathToAnchors, simplifyAnchorsAt,
  type AnchorSet, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import {
  DEFAULT_SIMPLIFY_TOLERANCE, depOf, editingLayer, inPlane, pathEditPreview, pathOperationTags,
} from '@weasel-js/core';

/** The brush's radius on screen when no param names one. */
export const SIMPLIFY_BRUSH_RADIUS_PX = 12;

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
 * undo step on release. It has no binding of its own: `useSimplifyBrushTool`
 * binds it.
 */
export const simplifyBrushAction: Action & { requires: string[] } = inPlane({
  id: 'simplifyBrush',
  label: 'Simplify brush',
  tags: pathOperationTags('brush'),
  cursor: (params) => brushRingCursor(radiusOf(params as SimplifyBrushParams | undefined)),
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

      const params = () => resolveParams(opts?.params) as SimplifyBrushParams | undefined;
      const radiusPx = (): number => radiusOf(params());
      const tolerance = (): number => toleranceOf(params());
      const scale = () => ctx.deps.view?.get().scale;
      const trail: Point[] = [];
      const gathered = new Set<number>();
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;

      const sweepTo = (p: Point): void => {
        const from = trail[trail.length - 1] ?? p;
        trail.push({ x: p.x, y: p.y });
        const before = gathered.size;
        for (const i of anchorsUnderBrush(originSet, from, p, { radiusPx: radiusPx(), scale: scale() })) {
          gathered.add(i);
        }
        if (gathered.size === before) return;
        current = editAnchorSetTracked(origin, (set) => simplifyAnchorsAt(set, gathered, tolerance()));
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
          if (reason === 'cancel') { current = null; return; }
          // The tolerance as it stands at release decides the commit.
          const done = gathered.size > 0
            ? editAnchorSetTracked(origin, (set) => simplifyAnchorsAt(set, gathered, tolerance()))
            : null;
          current = null;
          if (!done) return;
          dep.applyEdit(id, done.path, 'Simplify brush', done.origins);
          // Thinning renumbers every anchor after the first one removed.
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

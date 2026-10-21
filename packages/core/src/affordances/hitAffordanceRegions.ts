/**
 * The one affordance hit-test walk: an affordance's `regions()` is the single
 * source of truth for where its chrome is and what a press on it means.
 */

import type { View } from 'core/viewport/view';
import { multiply, scale, scaleDelta, screenAngleOf, standoff, strokeHitTest } from '@weasel-js/geom';
import type { ChromeState } from 'core/selection/chromeState';
import {
  angleOf, IDENTITY_TARGET, localToWorld, normalToWorld, pxExtentIn, targetTransformOf, worldToLocal,
  type TargetTransform,
} from 'core/geometry/targetFrame';
import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';
import type { CursorSpec } from '@weasel-js/cursor';
import { edgeHandlesFit } from 'interactions/actions/resize/cornerHandles';

/** What the walk found: the region, plus the ids needed to describe it. */
export interface AffordanceRegionHit {
  /** `Affordance.id` — also the chrome-caps visibility id. */
  affordanceId: string;
  /** `AffordanceRegion.id`. */
  regionId: string;
  /** The region itself, so callers can read `hitKind`. */
  region: AffordanceRegion;
  /** The region's cursor at the hit point. */
  cursor?: CursorSpec;
  /** Result of the region's `bind()`, called exactly once. */
  binding: AffordanceBinding;
}

/**
 * Walk affordances for a world-space hit, topmost first.
 *
 * **Across affordances**: order mirrors paint. Affordances are drawn first →
 * last (bottom → top), so the walk runs last → first and stops at the first
 * one that claims the point. Layering wins outright — a nearer region on a
 * lower affordance does not beat a farther one on top of it.
 *
 * **Within an affordance**: the *nearest* hit region wins, ties going to the
 * later-declared one. Regions overlap: the four corner handles of a selection
 * smaller than the hit radius all contain the same click.
 *
 * `isVisible` (when supplied) gates by the same chrome id used at paint time,
 * so chrome that isn't drawn can't be hit either.
 */
export function hitAffordanceRegions(
  affordances: readonly Affordance[],
  wx: number,
  wy: number,
  state: ChromeState,
  view: View,
  isVisible?: (id: string) => boolean,
): AffordanceRegionHit | null {
  for (let i = affordances.length - 1; i >= 0; i--) {
    const a = affordances[i];
    if (isVisible && !isVisible(a.id)) continue;
    const regions = a.regions(state);
    let best: { region: AffordanceRegion; d2: number } | null = null;
    for (let j = 0; j < regions.length; j++) {
      const region = regions[j];
      if (isVisible && region.chromeId && !isVisible(region.chromeId)) continue;
      const xf = transformOf(state, region.targetId);
      if (!hitRegion(region, wx, wy, xf, view)) continue;
      const d2 = regionDistance2(region, wx, wy, xf, view);
      // `<=` so a later-declared region wins an exact tie, preserving the
      // "later is on top" reading of declaration order.
      if (best === null || d2 <= best.d2) best = { region, d2 };
    }
    if (best) {
      const { cursor } = best.region;
      const at = typeof cursor === 'function' ? cursor({ x: wx, y: wy }, view) : cursor;
      return {
        affordanceId: a.id,
        regionId: best.region.id,
        region: best.region,
        ...(at !== undefined ? { cursor: at } : {}),
        binding: best.region.bind(),
      };
    }
  }
  return null;
}

/** Squared world distance from the point to a region's representative center,
 *  used only to rank regions that all already contain the point. */
function regionDistance2(
  region: AffordanceRegion,
  wx: number,
  wy: number,
  xf: TargetTransform,
  view: View,
): number {
  const s = region.shape;
  if (s.kind === 'outline') return 0;
  const w = s.kind === 'point'
    ? pointRegionAnchor(s, xf, view)
    : s.kind === 'annulus'
      ? localToWorld(xf, s.cx, s.cy)
      : localToWorld(xf, s.x + s.width / 2, s.y + s.height / 2);
  const dx = w.x - wx;
  const dy = w.y - wy;
  return dx * dx + dy * dy;
}

// ─── Transform helpers ──────────────────────────────────────────────────────

export { angleOf, localToWorld, type TargetTransform };

/** The frame `targetId`'s bounds are drawn in; identity for no target. */
export function transformOf(state: ChromeState, targetId: string | null): TargetTransform {
  if (targetId === null) return IDENTITY_TARGET;
  return targetTransformOf(state.boundsOf(targetId));
}

// ─── Shape resolution ───────────────────────────────────────────────────────

type PointShape = Extract<AffordanceRegion['shape'], { kind: 'point' }>;

/** Where a point region's hit square sits: its center in world coords, its
 *  turn on screen, its screen half-extent, and the span of the square that
 *  takes a press along each of its own axes (`[-half, half]` unless
 *  `cornerOf` cuts it). */
export function pointRegionFrame(
  shape: PointShape,
  xf: TargetTransform,
  view: View,
): { x: number; y: number; angle: number; half: number; u: [number, number]; v: [number, number] } {
  const a = pointRegionAnchor(shape, xf, view);
  const angle = shape.turned ? screenAngleOf(angleOf(xf), view.scale) : 0;
  const half = shape.hitRadiusPx;
  const u: [number, number] = [-half, half];
  const v: [number, number] = [-half, half];
  const body = shape.cornerOf;
  if (body) {
    // The body in world units that spans four hit radii on screen, per axis.
    const floor = pxExtentIn(SMALL_BODY_RADII * half, view.scale, xf);
    // `v` runs a quarter turn on from `u` on screen, which is the target's +y
    // only while the view and the target's frame keep their handedness.
    const [a, b, c, d] = xf.toWorld;
    const vOut = body.outward.y * Math.sign(view.scale.x * view.scale.y * (a * d - b * c));
    if (body.width < floor.x) u[body.outward.x > 0 ? 0 : 1] = 0;
    if (body.height < floor.y) v[vOut > 0 ? 0 : 1] = 0;
  }
  return { x: a.x, y: a.y, angle, half, u, v };
}

/** Whether a point region is live in `view`: false for an edge handle whose
 *  body is too small on screen to have room for one (`edgeOf`). A region that
 *  is not live is neither hit nor painted. */
export function pointRegionLive(shape: PointShape, xf: TargetTransform, view: View): boolean {
  return !shape.edgeOf || edgeHandlesFit(shape.edgeOf, xf, view.scale, shape.hitRadiusPx);
}

/** A body under this many hit radii across gives up the inward half of each
 *  corner's hit square, so there is somewhere on it that is not a handle. */
const SMALL_BODY_RADII = 4;

/** A point region's hit square as four screen-space corners, relative to its
 *  world center carried to the screen by `toScreen`. */
export function pointRegionScreenQuad(
  shape: PointShape,
  xf: TargetTransform,
  view: View,
  toScreen: (x: number, y: number) => [number, number],
): { x: number; y: number }[] {
  const f = pointRegionFrame(shape, xf, view);
  const [cx, cy] = toScreen(f.x, f.y);
  const c = Math.cos(f.angle), sn = Math.sin(f.angle);
  return [[f.u[0], f.v[0]], [f.u[1], f.v[0]], [f.u[1], f.v[1]], [f.u[0], f.v[1]]].map(([u, v]) => ({
    x: cx + c * u - sn * v,
    y: cy + sn * u + c * v,
  }));
}

/** A point region's anchor in world coords, its `standoff` applied. */
export function pointRegionAnchor(
  shape: PointShape,
  xf: TargetTransform,
  view: View,
): { x: number; y: number } {
  const a = localToWorld(xf, shape.x, shape.y);
  if (!shape.standoff) return a;
  return standoff(a, normalToWorld(xf, shape.standoff.normal), shape.standoff.px, view.scale);
}

/**
 * An annulus region's effective outer semi-axes, in world units, with the
 * screen-space `minBandPx` floor on band thickness applied. Paint calls it
 * too, so the visible ring and the hoverable ring are the same ring.
 */
export function annulusSemiAxes(
  shape: Extract<AffordanceRegion['shape'], { kind: 'annulus' }>,
  view: View,
  /** The target's frame, which decides what a screen pixel is along each of
   *  its axes. */
  xf: TargetTransform = IDENTITY_TARGET,
): { rx: number; ry: number } {
  const bandPx = shape.minBandPx ?? 0;
  if (bandPx === 0) return { rx: shape.rx, ry: shape.ry };
  const band = pxExtentIn(bandPx, view.scale, xf);
  return {
    rx: Math.max(shape.rx, shape.innerWidth / 2 + band.x),
    ry: Math.max(shape.ry, shape.innerHeight / 2 + band.y),
  };
}

// ─── Per-shape hit-test ─────────────────────────────────────────────────────

function hitRegion(
  region: AffordanceRegion,
  wx: number,
  wy: number,
  xf: TargetTransform,
  view: View,
): boolean {
  if (region.shape.kind === 'point') {
    // Square hit, not circular: the handle a `point` region paints is a
    // square, and a circle leaves its corners unclickable.
    //
    // Compared in screen space: testing it in the target's local frame would
    // stretch it under non-uniform zoom.
    if (!pointRegionLive(region.shape, xf, view)) return false;
    const f = pointRegionFrame(region.shape, xf, view);
    const d = scaleDelta(wx - f.x, wy - f.y, view.scale);
    const c = Math.cos(f.angle), sn = Math.sin(f.angle);
    const u = c * d.x + sn * d.y, v = -sn * d.x + c * d.y;
    return u >= f.u[0] && u <= f.u[1] && v >= f.v[0] && v <= f.v[1];
  }
  const local = worldToLocal(xf, wx, wy);
  if (!local) return false;
  if (region.shape.kind === 'outline') {
    const s = region.shape;
    return strokeHitTest(s.path, local.x, local.y, 0, {
      slop: { px: s.hitRadiusPx, transform: multiply(scale(view.scale.x, view.scale.y), xf.toWorld) },
    });
  }
  if (region.shape.kind === 'annulus') {
    const s = region.shape;
    // Outside the inner-rect cutout?
    const insideInner =
      local.x >= s.innerX && local.x <= s.innerX + s.innerWidth &&
      local.y >= s.innerY && local.y <= s.innerY + s.innerHeight;
    if (insideInner) return false;
    // Inside the outer ellipse? `((x-cx)/rx)² + ((y-cy)/ry)² ≤ 1`.
    const { rx, ry } = annulusSemiAxes(s, view, xf);
    if (rx <= 0 || ry <= 0) return false;
    const ex = (local.x - s.cx) / rx;
    const ey = (local.y - s.cy) / ry;
    return ex * ex + ey * ey <= 1;
  }
  // rect: axis-aligned in local frame.
  const r = region.shape;
  return local.x >= r.x && local.x <= r.x + r.width
      && local.y >= r.y && local.y <= r.y + r.height;
}

/**
 * The one affordance hit-test walk.
 *
 * The kit used to hit-test selection chrome two ways: this region walk
 * (reached through `composeAffordanceLayer`'s `RenderLayer.hitTest`) and a
 * hand-written classifier in `canvas/affordanceAt.ts` that re-derived corner
 * positions, the rotate ring, and anchor points from `ChromeState` itself.
 * Both read the same state and answered the same question, so the geometry
 * lived twice and could disagree — and only the hand-written side ran for the
 * kit's own chrome, which is why `AffordanceRegion.cursor` was declared, set,
 * and never consumed.
 *
 * Now there is one walk. `composeAffordanceLayer.hitTest` delegates here, and
 * so does `buildAffordanceAt`, so an affordance's `regions()` is the single
 * source of truth for where its chrome is and what a press on it means.
 */

import type { View } from 'core/viewport/view';
import { pxExtent, scaleDelta, screenAngleOf, standoff } from 'core/viewport/pxExtent';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import { poseRotationOf } from 'core/geometry/poseRotation';
import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';

/** What the walk found: the region, plus the ids needed to describe it. */
export interface AffordanceRegionHit {
  /** `Affordance.id` — also the chrome-caps visibility id. */
  affordanceId: string;
  /** `AffordanceRegion.id`. */
  regionId: string;
  /** The region itself, so callers can read `hitKind` / `cursor`. */
  region: AffordanceRegion;
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
 * later-declared one. Both hit-testers this replaced took the first region
 * they found instead, in opposite orders, which is only invisible while
 * regions don't overlap. They do: the four corner handles of a selection
 * smaller than the hit radius all contain the same click, and "first in the
 * table" silently answered top-left (or bottom-right) no matter which handle
 * the pointer was actually on.
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
      const xf = transformOf(state, region.targetId);
      if (!hitRegion(region, wx, wy, xf, view)) continue;
      const d2 = regionDistance2(region, wx, wy, xf, view);
      // `<=` so a later-declared region wins an exact tie, preserving the
      // "later is on top" reading of declaration order.
      if (best === null || d2 <= best.d2) best = { region, d2 };
    }
    if (best) {
      return {
        affordanceId: a.id,
        regionId: best.region.id,
        region: best.region,
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

/** Local↔world transform for an affordance target. Translation is the AABB
 *  origin; rotation is around the AABB center. `identity` short-circuits the
 *  math when the target isn't rotated. */
export interface TargetTransform {
  /** Rotation pivot (AABB center) in world coords. */
  cx: number;
  cy: number;
  /** cos(rotation) — 1 when identity. */
  cos: number;
  /** sin(rotation) — 0 when identity. */
  sin: number;
  identity: boolean;
}

const IDENTITY_XF: TargetTransform = { cx: 0, cy: 0, cos: 1, sin: 0, identity: true };

export function transformOf(state: ChromeState, targetId: string | null): TargetTransform {
  if (targetId === null) return IDENTITY_XF;
  const b: Bounds | null = state.boundsOf(targetId);
  if (!b) return IDENTITY_XF;
  // Pivot + angle come from the kit's one rotation convention.
  const r = poseRotationOf(b);
  if (!r) return IDENTITY_XF;
  return {
    cx: r.cx,
    cy: r.cy,
    cos: Math.cos(r.rotation),
    sin: Math.sin(r.rotation),
    identity: false,
  };
}

/** A target transform's rotation in radians, for cursors baked at an angle. */
export function angleOf(xf: TargetTransform): number {
  return xf.identity ? 0 : Math.atan2(xf.sin, xf.cos);
}

/** local point → world point. */
export function localToWorld(xf: TargetTransform, lx: number, ly: number): { x: number; y: number } {
  if (xf.identity) return { x: lx, y: ly };
  const dx = lx - xf.cx;
  const dy = ly - xf.cy;
  return {
    x: xf.cx + xf.cos * dx - xf.sin * dy,
    y: xf.cy + xf.sin * dx + xf.cos * dy,
  };
}

/** world point → local point. */
function worldToLocal(xf: TargetTransform, wx: number, wy: number): { x: number; y: number } {
  if (xf.identity) return { x: wx, y: wy };
  const dx = wx - xf.cx;
  const dy = wy - xf.cy;
  // Inverse rotation: cos stays, sin negates.
  return {
    x: xf.cx + xf.cos * dx + xf.sin * dy,
    y: xf.cy - xf.sin * dx + xf.cos * dy,
  };
}

// ─── Shape resolution ───────────────────────────────────────────────────────

type PointShape = Extract<AffordanceRegion['shape'], { kind: 'point' }>;

/** Where a point region's hit square sits: its center in world coords, its
 *  turn on screen, and its screen half-extent. Hit-test, paint, the debug
 *  hitbox and the slops overlay all read it from here. */
export function pointRegionFrame(
  shape: PointShape,
  xf: TargetTransform,
  view: View,
): { x: number; y: number; angle: number; half: number } {
  const a = pointRegionAnchor(shape, xf, view);
  const angle = shape.turned ? screenAngleOf(angleOf(xf), view.scale) : 0;
  return { x: a.x, y: a.y, angle, half: shape.hitRadiusPx };
}

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
  const c = Math.cos(f.angle) * f.half, sn = Math.sin(f.angle) * f.half;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({
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
  const n = shape.standoff.normal;
  const wn = xf.identity
    ? n
    : { x: xf.cos * n.x - xf.sin * n.y, y: xf.sin * n.x + xf.cos * n.y };
  return standoff(a, wn, shape.standoff.px, view.scale);
}

/**
 * An annulus region's effective outer semi-axes, with `minBandPx` applied.
 *
 * The affordance declares the natural ellipse (typically the smallest one
 * containing the inner rect) plus a screen-space floor on band thickness;
 * this is where the floor becomes world units, because this is where the view
 * is known. Paint calls it too, so the visible ring and the hoverable ring
 * are the same ring.
 */
export function annulusSemiAxes(
  shape: Extract<AffordanceRegion['shape'], { kind: 'annulus' }>,
  view: View,
  /** The target's rotation, which decides what a screen pixel is along each
   *  of its axes. */
  rotation = 0,
): { rx: number; ry: number } {
  const bandPx = shape.minBandPx ?? 0;
  if (bandPx === 0) return { rx: shape.rx, ry: shape.ry };
  const band = pxExtent(bandPx, view.scale, rotation);
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
  const local = worldToLocal(xf, wx, wy);
  if (region.shape.kind === 'point') {
    // Square hit, not circular: the handle a `point` region paints is a
    // square, and the hit zone should match what the user sees. (The old
    // hand-written classifier used a circle here, which made the corners of
    // an 8px handle unclickable.)
    //
    // Compared in screen space, where that square is axis-aligned. Testing it
    // in the target's local frame instead would tilt it under a rotated
    // target and stretch it under non-uniform zoom.
    const f = pointRegionFrame(region.shape, xf, view);
    const d = scaleDelta(wx - f.x, wy - f.y, view.scale);
    const c = Math.cos(f.angle), sn = Math.sin(f.angle);
    const u = c * d.x + sn * d.y, v = -sn * d.x + c * d.y;
    return Math.abs(u) <= f.half && Math.abs(v) <= f.half;
  }
  if (region.shape.kind === 'annulus') {
    const s = region.shape;
    // Outside the inner-rect cutout?
    const insideInner =
      local.x >= s.innerX && local.x <= s.innerX + s.innerWidth &&
      local.y >= s.innerY && local.y <= s.innerY + s.innerHeight;
    if (insideInner) return false;
    // Inside the outer ellipse? `((x-cx)/rx)² + ((y-cy)/ry)² ≤ 1`.
    const { rx, ry } = annulusSemiAxes(s, view, angleOf(xf));
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

import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '@weasel-js/renderer';
import type { ChromeState } from 'core/selection/chromeState';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { isRigid, pxExtentIn, targetCorners } from 'core/geometry/targetFrame';
import type { DebugSink } from '../debug/types';
import type { CommandFill, CommandStroke } from '@weasel-js/paint';
import { boundsOfPath, PATH_M, PATH_L, PATH_Z, lerp, type Rect } from '@weasel-js/geom';
import {
  angleOf,
  annulusSemiAxes,
  hitAffordanceRegions,
  localToWorld,
  pointRegionAnchor,
  pointRegionFrame,
  pointRegionLive,
  pointRegionScreenQuad,
  regionShown,
  transformOf,
  type TargetTransform,
} from './hitAffordanceRegions';
import type {
  Affordance,
  AffordanceRegion,
  CustomPaintContext,
  LayerHit,
} from './types';

/**
 * Bundle a list of Affordances into a single RenderLayer.
 *
 * Paint order matches array order (first → last = bottom → top). Hit-test walks affordances in
 * reverse and stops at the first that claims the point; within it the nearest region wins.
 *
 * `decorate(state, view)` runs *after* a given affordance's regions, for paint only.
 *
 * The layer takes whatever data the canvas hands its layers and reads the chrome state off it,
 * so it registers with `registerLayer` or a `layers` slot as it is.
 */
export function composeAffordanceLayer(
  id: string,
  label: string,
  affordances: readonly Affordance[],
): RenderLayer<unknown> & {
  hitTest(
    wx: number,
    wy: number,
    state: unknown,
    view: View,
    dims: { width: number; height: number },
    isVisible?: (id: string) => boolean,
  ): LayerHit | null;
} {
  return {
    id,
    label,
    space: 'screen',
    draw: (data, view, _dims): DrawCommand[] => {
      const state = asChromeState(data);
      const debug = asDebugSink(data);
      const isVisible = asIsVisible(data);
      const out: DrawCommand[] = [];
      const t = viewToTransform(view);
      for (const a of affordances) {
        if (isVisible && !isVisible(a.id)) continue;
        for (const region of a.regions(state)) {
          if (!regionShown(region, isVisible)) continue;
          const xf = transformOf(state, region.targetId);
          if (region.shape.kind === 'point' && !pointRegionLive(region.shape, xf, view)) continue;
          if (region.paint) paintRegion(region, xf, view, state, t, out);
          if (debug) recordRegionHitbox(debug, a.id, region, xf, view);
        }
        if (a.decorate) {
          for (const cmd of a.decorate(state, view)) out.push(cmd);
        }
      }
      return out;
    },
    // The walk lives in `hitAffordanceRegions` so this layer and `buildAffordanceAt` share one
    // implementation. This wrapper lifts the region's declared cursor and claim onto the binding.
    hitTest: (wx, wy, data, view, _dims, isVisible): LayerHit | null => {
      const state = asChromeState(data);
      if (!state) return null;
      const hit = hitAffordanceRegions(
        affordances, wx, wy, state, view, isVisible ?? asIsVisible(data) ?? undefined,
      );
      if (!hit) return null;
      const { cursor } = hit;
      const { strength, claimedKinds } = hit.region;
      return {
        ...hit.binding,
        ...(cursor !== undefined ? { cursor } : {}),
        ...(strength !== undefined ? { strength } : {}),
        ...(claimedKinds !== undefined ? { claimedKinds } : {}),
      };
    },
  };
}

// `draw` is called by Canvas with `CanvasHelpers` and by tests with a bare `ChromeState`.
function asChromeState(data: unknown): ChromeState {
  const maybe = data as { getChromeState?: () => ChromeState };
  if (typeof maybe?.getChromeState === 'function') return maybe.getChromeState();
  return data as ChromeState;
}

function asDebugSink(data: unknown): DebugSink | null {
  const maybe = data as { getDebug?: () => DebugSink | null };
  if (typeof maybe?.getDebug === 'function') return maybe.getDebug();
  return null;
}

/** The chrome-caps visibility predicate off the data envelope. When absent (tests passing
 *  bare state), every affordance renders. */
function asIsVisible(data: unknown): ((id: string) => boolean) | null {
  const maybe = data as { getIsVisible?: () => (id: string) => boolean };
  if (typeof maybe?.getIsVisible === 'function') return maybe.getIsVisible();
  return null;
}

function recordRegionHitbox(
  debug: DebugSink,
  affordanceId: string,
  region: AffordanceRegion,
  xf: TargetTransform,
  view: View,
): void {
  if (region.shape.kind === 'point') {
    // The hit square is a square on *screen* — turned with the target when the
    // region asks — so in world it is a parallelogram, recorded as one.
    const f = pointRegionFrame(region.shape, xf, view);
    const quad = pointRegionScreenQuad(region.shape, xf, view, (x, y) => [x, y]);
    debug.recordHitbox(affordanceId, 'handle', {
      kind: 'polygon',
      points: quad.map((q) => ({
        x: f.x + (q.x - f.x) / view.scale.x,
        y: f.y + (q.y - f.y) / view.scale.y,
      })),
    });
    return;
  }
  if (region.shape.kind === 'annulus') {
    // Approximated as the outer ellipse's AABB: the DebugSink's hitbox primitives don't
    // model ring shapes.
    const s = region.shape;
    const { rx, ry } = annulusSemiAxes(s, view, xf);
    recordLocalRect(debug, affordanceId, xf, { x: s.cx - rx, y: s.cy - ry, width: 2 * rx, height: 2 * ry });
    return;
  }
  const box = region.shape.kind === 'outline' ? boundsOfPath(region.shape.path) : region.shape;
  recordLocalRect(debug, affordanceId, xf, box);
}

/** A rect of the target's own frame as a debug hitbox: the unturned box plus
 *  the rotation while the frame only turns it, and the quad it lands on once
 *  the frame skews or stretches it. */
function recordLocalRect(
  debug: DebugSink,
  affordanceId: string,
  xf: TargetTransform,
  r: Rect,
): void {
  if (!isRigid(xf)) {
    debug.recordHitbox(affordanceId, 'handle', { kind: 'polygon', points: targetCorners(r, xf) });
    return;
  }
  const w = localToWorld(xf, r.x + r.width / 2, r.y + r.height / 2);
  debug.recordHitbox(affordanceId, 'handle', {
    kind: 'rect',
    x: w.x - r.width / 2,
    y: w.y - r.height / 2,
    width: r.width,
    height: r.height,
    ...(xf.identity ? {} : { rotation: angleOf(xf) }),
  });
}

function paintRegion(
  region: AffordanceRegion,
  xf: TargetTransform,
  view: View,
  state: ChromeState,
  viewT: ReturnType<typeof viewToTransform>,
  out: DrawCommand[],
): void {
  const paint = region.paint!;
  if (paint.kind === 'square') {
    if (region.shape.kind !== 'point') {
      // 'square' only makes sense over a point shape.
      return;
    }
    // Same frame the hit-test reads, at the paint's own size.
    const f = pointRegionFrame(region.shape, xf, view);
    const [sx, sy] = worldToScreen(f.x, f.y, viewT);
    const half = paint.sizePx / 2;
    const fill = paint.fill ? { fill: paint.fill } : {};
    const stroke = paint.stroke ? { stroke: paint.stroke } : {};
    if (f.angle === 0) {
      out.push({
        kind: 'path',
        path: { kind: 'rect', x: sx - half, y: sy - half, width: paint.sizePx, height: paint.sizePx },
        ...fill, ...stroke,
      });
      return;
    }
    const c = Math.cos(f.angle) * half, sn = Math.sin(f.angle) * half;
    const coords = new Float32Array(8);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], i) => {
      coords[i * 2] = sx + c * u - sn * v;
      coords[i * 2 + 1] = sy + sn * u + c * v;
    });
    out.push({
      kind: 'path',
      path: { kind: 'polygon', commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]), coords, fillRule: 'nonzero' },
      ...fill, ...stroke,
    });
    return;
  }
  if (paint.kind === 'annulus') {
    if (region.shape.kind !== 'annulus') return; // type mismatch — silent skip
    const s = region.shape;
    // The screen-px inset in target-local units, so it visually matches at any zoom.
    const insetLocal = pxExtentIn(paint.insetPx ?? 0, view.scale, xf);
    // Same `minBandPx` clamp the hit-test applies, so the ring you can see is
    // the ring you can grab.
    const cmd = annulusCommand(s, annulusSemiAxes(s, view, xf), insetLocal, xf, viewT, paint.fill, paint.stroke);
    if (cmd) out.push(cmd);
    return;
  }
  if (paint.kind === 'custom') {
    const ctx: CustomPaintContext = {
      world: worldOf(region, xf, view),
      local: region.shape,
      view,
      state,
    };
    for (const cmd of paint.draw(ctx)) out.push(cmd);
    return;
  }
}

/** Build a screen-space DrawCommand for an annulus region: the area
 *  inside the (contracted) outer ellipse but outside the (expanded)
 *  inner rect, wherever that rect sits. Renders as up to four cap
 *  subpaths, one past each rect edge, whose union is `ellipse \ rect`.
 *  Every cap is traced the same way round, so where two overlap (a rect
 *  corner inside the ellipse) nonzero fills the overlap rather than
 *  cancelling it. Returns null when no cap is left. */
function annulusCommand(
  shape: Extract<AffordanceRegion['shape'], { kind: 'annulus' }>,
  semiAxes: { rx: number; ry: number },
  insetLocal: { x: number; y: number },
  xf: TargetTransform,
  viewT: ReturnType<typeof viewToTransform>,
  fill: CommandFill | undefined,
  stroke: CommandStroke | undefined,
): DrawCommand | null {
  const rx = semiAxes.rx - insetLocal.x;
  const ry = semiAxes.ry - insetLocal.y;
  if (rx <= 0 || ry <= 0) return null;
  const cx = shape.cx;
  const cy = shape.cy;
  // The expanded inner rect's edges, relative to the ellipse center.
  const left = shape.innerX - insetLocal.x - cx;
  const right = shape.innerX + shape.innerWidth + insetLocal.x - cx;
  const top = shape.innerY - insetLocal.y - cy;
  const bottom = shape.innerY + shape.innerHeight + insetLocal.y - cy;

  // Line segments per cap arc; 24 is smooth at typical zooms.
  const SAMPLES = 24;
  const cmds: number[] = [];
  const localPts: { x: number; y: number }[] = [];

  // Traces `t0 → t1` (t1 > t0) along the ellipse; PATH_Z closes along the
  // rect edge, since both endpoints share that edge's coordinate.
  function appendCap(t0: number, t1: number): void {
    cmds.push(PATH_M);
    localPts.push({ x: cx + rx * Math.cos(t0), y: cy + ry * Math.sin(t0) });
    for (let i = 1; i <= SAMPLES; i++) {
      const t = lerp(t0, t1, i / SAMPLES);
      cmds.push(PATH_L);
      localPts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    cmds.push(PATH_Z);
  }
  const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

  // Above the rect: sin t < top / ry.
  if (top > -ry) {
    const p = Math.asin(clamp1(top / ry));
    appendCap(-Math.PI - p, p);
  }
  // Below it: sin t > bottom / ry.
  if (bottom < ry) {
    const p = Math.asin(clamp1(bottom / ry));
    appendCap(p, Math.PI - p);
  }
  // Right of it: cos t > right / rx.
  if (right < rx) {
    const q = Math.acos(clamp1(right / rx));
    appendCap(-q, q);
  }
  // Left of it: cos t < left / rx.
  if (left > -rx) {
    const q = Math.acos(clamp1(left / rx));
    appendCap(q, 2 * Math.PI - q);
  }
  if (cmds.length === 0) return null;

  const coords = new Float32Array(localPts.length * 2);
  for (let i = 0; i < localPts.length; i++) {
    const w = localToWorld(xf, localPts[i].x, localPts[i].y);
    const [sx, sy] = worldToScreen(w.x, w.y, viewT);
    coords[i * 2] = sx;
    coords[i * 2 + 1] = sy;
  }
  return {
    kind: 'path',
    path: { kind: 'polygon', commands: new Uint8Array(cmds), coords, fillRule: 'nonzero' },
    ...(fill ? { fill } : {}),
    ...(stroke ? { stroke } : {}),
  };
}

function worldOf(region: AffordanceRegion, xf: TargetTransform, view: View): CustomPaintContext['world'] {
  if (region.shape.kind === 'point') {
    const w = pointRegionAnchor(region.shape, xf, view);
    return { x: w.x, y: w.y };
  }
  if (region.shape.kind === 'annulus') {
    // The outer ellipse's bounding box in world coords: each half-extent is
    // the length of that row of the frame applied to the semi-axes.
    const s = region.shape;
    const { rx, ry } = annulusSemiAxes(s, view, xf);
    const c = localToWorld(xf, s.cx, s.cy);
    const [ma, mb, mc, md] = xf.toWorld;
    const hw = Math.hypot(rx * ma, ry * mc);
    const hh = Math.hypot(rx * mb, ry * md);
    return { x: c.x - hw, y: c.y - hh, width: 2 * hw, height: 2 * hh };
  }
  // Rect: under rotation, width/height describe the AABB of the rotated rect. Affordances
  // needing exact rotated geometry can read `local` and reapply the rotation themselves.
  const r = region.shape.kind === 'outline' ? boundsOfPath(region.shape.path) : region.shape;
  const a = localToWorld(xf, r.x, r.y);
  const b = localToWorld(xf, r.x + r.width, r.y);
  const c = localToWorld(xf, r.x, r.y + r.height);
  const d = localToWorld(xf, r.x + r.width, r.y + r.height);
  const minX = Math.min(a.x, b.x, c.x, d.x);
  const minY = Math.min(a.y, b.y, c.y, d.y);
  const maxX = Math.max(a.x, b.x, c.x, d.x);
  const maxY = Math.max(a.y, b.y, c.y, d.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Hit-testing lives in `hitAffordanceRegions.ts` — see `hitRegion` there.

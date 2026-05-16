import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../renderer';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { meanScale } from 'core/viewport/meanScale';
import type { DebugSink } from '../debug/types';
import type {
  Affordance,
  AffordanceBinding,
  AffordanceRegion,
  CustomPaintContext,
} from './types';

/**
 * @experimental
 * Bundle a list of Affordances into a single RenderLayer.
 *
 * Each affordance declares interactive regions in target-local coordinates;
 * this layer composes each target's bounds transform (rotation around the
 * AABB center, when present) once per region for both paint and hit-test.
 *
 * FillStyle order matches array order (first → last = bottom → top). Hit-test
 * walks regions in reverse (top → bottom) and returns the first non-null
 * binding.
 *
 * `decorate(state, view)` runs *after* a given affordance's regions for
 * paint only — useful for leader lines and other purely-visual chrome that
 * don't fit the region model.
 */
export function composeAffordanceLayer(
  id: string,
  label: string,
  affordances: readonly Affordance[],
): RenderLayer<ChromeState> & {
  hitTest(
    wx: number,
    wy: number,
    state: ChromeState,
    view: View,
    dims: { width: number; height: number },
  ): AffordanceBinding | null;
} {
  return {
    id,
    label,
    space: 'screen',
    draw: (data, view, _dims): DrawCommand[] => {
      const state = asChromeState(data);
      const debug = asDebugSink(data);
      const out: DrawCommand[] = [];
      const t = viewToTransform(view);
      for (const a of affordances) {
        for (const region of a.regions(state)) {
          const xf = transformOf(state, region.targetId);
          if (region.paint) paintRegion(region, xf, view, state, t, out);
          if (debug) recordRegionHitbox(debug, a.id, region, xf, view);
        }
        if (a.decorate) {
          for (const cmd of a.decorate(state, view)) out.push(cmd);
        }
      }
      return out;
    },
    hitTest: (wx, wy, state, view, _dims): AffordanceBinding | null => {
      // Walk affordances last → first (top → bottom in paint order); within
      // each affordance, walk regions last → first for the same reason.
      for (let i = affordances.length - 1; i >= 0; i--) {
        const regs = affordances[i].regions(state);
        for (let j = regs.length - 1; j >= 0; j--) {
          const region = regs[j];
          const xf = transformOf(state, region.targetId);
          if (hitRegion(region, wx, wy, xf, view)) {
            return region.bind();
          }
        }
      }
      return null;
    },
  };
}

// ─── Data unwrappers ────────────────────────────────────────────────────────

// `draw` is called by Canvas with `CanvasHelpers` and by tests with a bare
// `ChromeState`. Tests stay terse this way, and production gets the live
// debug sink via the same channel.
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

function recordRegionHitbox(
  debug: DebugSink,
  affordanceId: string,
  region: AffordanceRegion,
  xf: TargetTransform,
  view: View,
): void {
  if (region.shape.kind === 'point') {
    const w = localToWorld(xf, region.shape.x, region.shape.y);
    const r = region.shape.hitRadiusPx / meanScale(view.scale);
    // Square hit (composeAffordanceLayer uses Manhattan-style abs<=r) but
    // the kit's only HitShape primitive for a square hit centered on a
    // point is rect, so emit a rotation-aware rect of side 2r centered on
    // the world anchor. Keeps the visualization faithful to the actual
    // hit-test region.
    debug.recordHitbox(affordanceId, 'handle', {
      kind: 'rect',
      x: w.x - r,
      y: w.y - r,
      width: r * 2,
      height: r * 2,
      ...(xf.identity ? {} : { rotation: Math.atan2(xf.sin, xf.cos) }),
    });
    return;
  }
  // rect: axis-aligned in local frame; apply target rotation around the
  // AABB pivot when present.
  const r = region.shape;
  const w = localToWorld(xf, r.x + r.width / 2, r.y + r.height / 2);
  debug.recordHitbox(affordanceId, 'handle', {
    kind: 'rect',
    x: w.x - r.width / 2,
    y: w.y - r.height / 2,
    width: r.width,
    height: r.height,
    ...(xf.identity ? {} : { rotation: Math.atan2(xf.sin, xf.cos) }),
  });
}

// ─── Transform helpers ──────────────────────────────────────────────────────

/** Local↔world transform for an affordance target. Translation is the AABB
 *  origin; rotation is around the AABB center. Returning `null` rotation
 *  signals identity rotation (no math needed). */
interface TargetTransform {
  cx: number;        // rotation pivot (AABB center) in world coords
  cy: number;
  cos: number;       // cos(rotation), 1 when identity
  sin: number;       // sin(rotation), 0 when identity
  identity: boolean; // true when rotation is 0 or bounds is null
}

const IDENTITY_XF: TargetTransform = { cx: 0, cy: 0, cos: 1, sin: 0, identity: true };

function transformOf(state: ChromeState, targetId: string | null): TargetTransform {
  if (targetId === null) return IDENTITY_XF;
  const b: Bounds | null = state.boundsOf(targetId);
  if (!b) return IDENTITY_XF;
  const rotation = b.rotation ?? 0;
  if (rotation === 0) return IDENTITY_XF;
  return {
    cx: b.x + b.width / 2,
    cy: b.y + b.height / 2,
    cos: Math.cos(rotation),
    sin: Math.sin(rotation),
    identity: false,
  };
}

/** local point → world point. */
function localToWorld(xf: TargetTransform, lx: number, ly: number): { x: number; y: number } {
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

// ─── FillStyle ──────────────────────────────────────────────────────────────────

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
      // 'square' only makes sense over a point shape. Silently skip — a
      // future paint variant can cover rect outlines.
      return;
    }
    const world = localToWorld(xf, region.shape.x, region.shape.y);
    const [sx, sy] = worldToScreen(world.x, world.y, viewT);
    const half = paint.sizePx / 2;
    const cmd: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: sx - half, y: sy - half, width: paint.sizePx, height: paint.sizePx },
      ...(paint.fill ? { fill: paint.fill } : {}),
      ...(paint.stroke ? { stroke: paint.stroke } : {}),
    };
    out.push(cmd);
    return;
  }
  if (paint.kind === 'custom') {
    const ctx: CustomPaintContext = {
      world: worldOf(region, xf),
      local: region.shape,
      view,
      state,
    };
    for (const cmd of paint.draw(ctx)) out.push(cmd);
    return;
  }
}

function worldOf(region: AffordanceRegion, xf: TargetTransform): CustomPaintContext['world'] {
  if (region.shape.kind === 'point') {
    const w = localToWorld(xf, region.shape.x, region.shape.y);
    return { x: w.x, y: w.y };
  }
  // Rect: map the rect's origin and far corner; width/height under rotation
  // describe the AABB of the rotated rect, which is what custom-paint
  // consumers most often want. Affordances needing exact rotated geometry
  // can read `local` + reapply rotation themselves via `view`/`state`.
  const r = region.shape;
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

// ─── Hit-test ───────────────────────────────────────────────────────────────

function hitRegion(
  region: AffordanceRegion,
  wx: number,
  wy: number,
  xf: TargetTransform,
  view: View,
): boolean {
  const local = worldToLocal(xf, wx, wy);
  if (region.shape.kind === 'point') {
    const radiusWorld = region.shape.hitRadiusPx / meanScale(view.scale);
    return Math.abs(local.x - region.shape.x) <= radiusWorld
        && Math.abs(local.y - region.shape.y) <= radiusWorld;
  }
  // rect: axis-aligned in local frame.
  const r = region.shape;
  return local.x >= r.x && local.x <= r.x + r.width
      && local.y >= r.y && local.y <= r.y + r.height;
}

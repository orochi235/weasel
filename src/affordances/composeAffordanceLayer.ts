import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../renderer';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { meanScale } from 'core/viewport/meanScale';
import type { DebugSink } from '../debug/types';
import type { FillStyle, Stroke } from 'core/paint-types';
import { PATH_M, PATH_L, PATH_Z } from 'features/paths/types';
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
    isVisible?: (id: string) => boolean,
  ): AffordanceBinding | null;
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
    hitTest: (wx, wy, state, view, _dims, isVisible): AffordanceBinding | null => {
      // Walk affordances last → first (top → bottom in paint order); within
      // each affordance, walk regions last → first for the same reason.
      // `isVisible` (when supplied) gates by the same chrome id used at
      // paint time so a hidden affordance can't be hit either.
      for (let i = affordances.length - 1; i >= 0; i--) {
        const a = affordances[i];
        if (isVisible && !isVisible(a.id)) continue;
        const regs = a.regions(state);
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

/** Pull a chrome-caps visibility predicate off the data envelope when
 *  present. When absent (legacy callers / tests passing bare state),
 *  every affordance renders — preserves pre-chrome-caps behavior. */
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
  if (region.shape.kind === 'annulus') {
    // Approximate the annulus visualization as the outer ellipse's AABB.
    // The DebugSink's hitbox primitives don't model ring shapes; the
    // always-visible dev paint (`paint.kind === 'annulus'`) draws the
    // actual ring. Consumers that want a precise debug overlay can match
    // against the affordance id and render the annulus themselves.
    const s = region.shape;
    const pts = [
      localToWorld(xf, s.cx + s.rx, s.cy),
      localToWorld(xf, s.cx - s.rx, s.cy),
      localToWorld(xf, s.cx, s.cy + s.ry),
      localToWorld(xf, s.cx, s.cy - s.ry),
    ];
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));
    debug.recordHitbox(affordanceId, 'handle', {
      kind: 'rect',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
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
  if (paint.kind === 'annulus') {
    if (region.shape.kind !== 'annulus') return; // type mismatch — silent skip
    const s = region.shape;
    // Convert the screen-px inset to target-local units so it visually
    // matches at any zoom. `localToWorld` is rotation+translation (no
    // scale), so target-local units equal world units for ring math.
    const insetLocal = (paint.insetPx ?? 0) / meanScale(view.scale);
    const cmd = annulusCommand(s, insetLocal, xf, viewT, paint.fill, paint.stroke);
    if (cmd) out.push(cmd);
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

/** Build a screen-space DrawCommand for an annulus region: the area
 *  inside the (contracted) outer ellipse but outside the (expanded)
 *  inner rect. Renders as four disjoint petal subpaths — one per rect
 *  edge — so the visible fill is true `ellipse \ rect`. A naive
 *  ellipse + rect even-odd path would also fill the rect's corner
 *  triangles where they poke past the contracted ellipse. Returns null
 *  when the band collapses on both axes. */
function annulusCommand(
  shape: Extract<AffordanceRegion['shape'], { kind: 'annulus' }>,
  insetLocal: number,
  xf: TargetTransform,
  viewT: ReturnType<typeof viewToTransform>,
  fill: FillStyle | undefined,
  stroke: Stroke | undefined,
): DrawCommand | null {
  const rx = shape.rx - insetLocal;
  const ry = shape.ry - insetLocal;
  if (rx <= 0 || ry <= 0) return null;
  const cx = shape.cx;
  const cy = shape.cy;
  // Expanded inner rect (still in target-local coords).
  const rectHW = shape.innerWidth / 2 + insetLocal;
  const rectHH = shape.innerHeight / 2 + insetLocal;
  // Each petal exists only when the corresponding rect edge actually
  // intersects the ellipse interior — otherwise the rect already
  // extends past the ellipse on that axis and there's no band to show.
  const haveTopBottom = rectHH < ry;
  const haveLeftRight = rectHW < rx;
  if (!haveTopBottom && !haveLeftRight) return null;
  const xT = haveTopBottom ? rx * Math.sqrt(1 - (rectHH / ry) ** 2) : 0;
  const yR = haveLeftRight ? ry * Math.sqrt(1 - (rectHW / rx) ** 2) : 0;

  // Sampling density per petal arc — line segments are visually clean
  // for the rotate-band band thickness and avoid the cubic-Bézier
  // sub-arc bookkeeping. 24 is smooth at typical zooms.
  const SAMPLES = 24;
  const cmds: number[] = [];
  const localPts: { x: number; y: number }[] = [];

  function appendPetal(t0: number, t1: number): void {
    cmds.push(PATH_M);
    localPts.push({ x: cx + rx * Math.cos(t0), y: cy + ry * Math.sin(t0) });
    for (let i = 1; i <= SAMPLES; i++) {
      const t = t0 + (t1 - t0) * (i / SAMPLES);
      cmds.push(PATH_L);
      localPts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    // PATH_Z closes back to the move-to point along the rect edge — both
    // endpoints share the rect-edge coord by construction, so the
    // closing segment IS the chord.
    cmds.push(PATH_Z);
  }

  if (haveTopBottom) {
    // Top petal: y < cy. Arc from right endpoint over t = -π/2 to left.
    appendPetal(
      Math.atan2(-rectHH / ry, xT / rx),   // in (-π/2, 0)
      Math.atan2(-rectHH / ry, -xT / rx),  // in (-π, -π/2), decreasing through -π/2
    );
    // Bottom petal: y > cy. Arc through t = +π/2.
    appendPetal(
      Math.atan2(rectHH / ry, xT / rx),    // in (0, π/2)
      Math.atan2(rectHH / ry, -xT / rx),   // in (π/2, π), increasing through π/2
    );
  }
  if (haveLeftRight) {
    // Right petal: x > cx. Arc through t = 0.
    appendPetal(
      Math.atan2(-yR / ry, rectHW / rx),   // in (-π/2, 0)
      Math.atan2(yR / ry, rectHW / rx),    // in (0, π/2)
    );
    // Left petal: x < cx. Arc through t = ±π. Shift the end angle by
    // -2π so the parametric trace passes through the leftmost point
    // monotonically instead of crossing the right side.
    appendPetal(
      Math.atan2(-yR / ry, -rectHW / rx),                  // in (-π, -π/2)
      Math.atan2(yR / ry, -rectHW / rx) - 2 * Math.PI,     // in (-3π/2, -π), decreasing through -π
    );
  }

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

function worldOf(region: AffordanceRegion, xf: TargetTransform): CustomPaintContext['world'] {
  if (region.shape.kind === 'point') {
    const w = localToWorld(xf, region.shape.x, region.shape.y);
    return { x: w.x, y: w.y };
  }
  if (region.shape.kind === 'annulus') {
    // Outer ellipse bounding box, in world coords. Map the four cardinal
    // extrema through the target transform and AABB the result. (Rotated
    // ellipses are still ellipses; their AABB needs all four points.)
    const s = region.shape;
    const pts = [
      localToWorld(xf, s.cx + s.rx, s.cy),
      localToWorld(xf, s.cx - s.rx, s.cy),
      localToWorld(xf, s.cx, s.cy + s.ry),
      localToWorld(xf, s.cx, s.cy - s.ry),
    ];
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
  if (region.shape.kind === 'annulus') {
    const s = region.shape;
    // Outside the inner-rect cutout?
    const insideInner =
      local.x >= s.innerX && local.x <= s.innerX + s.innerWidth &&
      local.y >= s.innerY && local.y <= s.innerY + s.innerHeight;
    if (insideInner) return false;
    // Inside the outer ellipse? `((x-cx)/rx)² + ((y-cy)/ry)² ≤ 1`.
    if (s.rx <= 0 || s.ry <= 0) return false;
    const ex = (local.x - s.cx) / s.rx;
    const ey = (local.y - s.cy) / s.ry;
    return ex * ex + ey * ey <= 1;
  }
  // rect: axis-aligned in local frame.
  const r = region.shape;
  return local.x >= r.x && local.x <= r.x + r.width
      && local.y >= r.y && local.y <= r.y + r.height;
}

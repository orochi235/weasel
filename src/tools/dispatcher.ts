// src/tools/dispatcher.ts
import type { AnyTool, ToolCtx, ToolSlot, Decision, ToolModifiers } from './types';
import { dlog } from '../debug/flag';
import type { RenderLayer } from 'core/layers/render';
import type { ChromeState } from 'core/selection/chromeState';
import type { View } from 'core/viewport/view';
import type { AffordanceBinding } from 'affordances/types';
import type { HitResult } from './routing/hitResult';
import type { RouteResolvedInfo } from './routing/reflection/route-resolved';
import type { NodeId } from 'core/scene/types';
import type { ToolDef, PhaseDef, RouteTable } from './routing/types';
import { resolveRoute } from './routing/lookup';

/** Build a HitResult for the dispatcher's context. Phase 1 classifier:
 *  - Affordance hits → 'affordance:unknown' kind (placeholder until the
 *    affordance layer carries kind metadata).
 *  - No node hit-test in Phase 1 dispatcher — regular pointer paths yield
 *    'empty' since the dispatcher doesn't run a scene hit-test.
 *  Subsequent phases will add a scene hit-test and propagate real node ids. */
function buildAffordanceTarget(
  affordanceHit: AffordanceBinding,
  adapter: unknown,
): HitResult {
  // AffordanceBinding doesn't carry a standard targetId in Phase 1.
  // Cast defensively to pick up any consumer-supplied targetId.
  const targetId = (affordanceHit as { targetId?: NodeId }).targetId;
  const kind =
    targetId != null
      ? ((adapter as { kindOf?: (id: NodeId) => string }).kindOf?.(targetId) ?? 'affordance:unknown')
      : 'affordance:unknown';
  return {
    category: 'affordance',
    kind,
    id: targetId ?? ('' as NodeId),
    pose: {},
    data: {},
  };
}

/** Build a HitResult for a regular (non-affordance) pointer event. Decision:
 *  populate `ctx.target` unconditionally — when no `getNodeAtPoint` is supplied
 *  or it returns null, fall back to an EmptyHit. Always-populated targets keep
 *  declarative route tables predictable; routing factories can match
 *  `'empty'` rather than guarding for `undefined`. */
function nodeHitFor(
  worldX: number,
  worldY: number,
  getNodeAtPoint: ToolsDispatcherOptions['getNodeAtPoint'],
): HitResult {
  const result = getNodeAtPoint?.(worldX, worldY);
  if (!result) return { category: 'empty', kind: 'empty' };
  return {
    category: 'node',
    kind: result.kind,
    id: result.id,
    pose: result.pose,
    data: result.data,
    meta: result.meta,
  };
}

/** Resolve a HitResult for a pointer event, consulting the active tool's
 *  `hitOverride` before the built-in node/empty test. If `tool.hitOverride`
 *  returns a value, that becomes the target (category `'tool'`); otherwise
 *  falls back to `nodeHitFor`. The `scratch` parameter is the tool's current
 *  scratch (initial scratch on pointer-down, in-flight scratch on move/up). */
function targetFor(
  rawCtx: { worldX: number; worldY: number; view: View; modifiers: ToolModifiers },
  tool: AnyTool | undefined,
  scratch: unknown,
  getNodeAtPoint: ToolsDispatcherOptions['getNodeAtPoint'],
): HitResult {
  if (tool?.hitOverride) {
    const override = tool.hitOverride({
      worldX: rawCtx.worldX,
      worldY: rawCtx.worldY,
      scratch: scratch as never,
      view: rawCtx.view,
      modifiers: rawCtx.modifiers,
    });
    if (override) {
      return { category: 'tool', kind: override.target, extra: override.extra };
    }
  }
  return nodeHitFor(rawCtx.worldX, rawCtx.worldY, getNodeAtPoint);
}

interface SlotsState {
  hotkey: AnyTool | null;
  active: AnyTool | null;
  ambient: AnyTool[];
  /** Optional fallback tool consulted ONLY for `pointer.onClick` when neither
   *  the active slot nor any ambient tool claimed the click. Lets a non-select
   *  tool (pen, ellipse, etc.) stay active while letting unhandled clicks fall
   *  through to the select tool for click-to-select. Not consulted for
   *  pointerdown, drag, keyboard, wheel, or dblTap. */
  fallback?: AnyTool | null;
}

/** @internal */
export interface ToolsDispatcherOptions {
  /** Called on every event to read the current slot occupants. The
   *  dispatcher keeps no copy — `useTools` owns slot state and updates
   *  it as the user activates / engages tools. */
  getSlots: () => SlotsState;
  /** Called once per channel-handler invocation to construct the ctx
   *  the handler receives. `<Canvas>` supplies world coords, modifiers,
   *  selection, adapter, and applyOps; the dispatcher injects scratch. */
  getCtx: (overrides?: {
    clientX?: number;
    clientY?: number;
    modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
  }) => Omit<ToolCtx, 'scratch'>;
  /** Pixel distance the pointer must travel before a click is reclassified
   *  as a drag. Default 4. */
  threshold?: number;
  /** Optional callback fired whenever an in-flight gesture starts or ends
   *  (including phase transitions pending → drag → end/cancel). `useTools`
   *  uses this to bump a render tick so consumers reading
   *  `dispatcher.getActiveScratch()` (e.g. function-form `cursor`) re-resolve
   *  on real DOM events. */
  onGestureChange?: () => void;
  /** Called whenever a declarative route resolves to an ActionFn. The
   *  dispatcher caches the most recent invocation; consumers read it via
   *  `getLastRoute()`. Useful for the kit's ToolDebugOverlay. */
  onRouteResolved?: (info: RouteResolvedInfo) => void;
  /** Time source for double-tap detection. Defaults to `Date.now`. Override
   *  in tests to drive the clock deterministically. */
  now?: () => number;
  /** Double-tap detection thresholds. */
  dblTap?: {
    /** Maximum interval between the two taps (ms). Default 300. */
    windowMs?: number;
    /** Maximum CSS-px distance between the two tap positions. Default 8. */
    maxDistance?: number;
  };
  /**
   * Optional. Returns the hit-test pipeline inputs:
   *   - `layers`: visible RenderLayers ordered TOP-DOWN (highest z-index first).
   *   - `chromeState`: passed as the `data` arg to each layer's hitTest call.
   *   - `view` / `dims`: passed to layer.hitTest for screen-space conversion.
   *
   * When supplied, the dispatcher consults each layer's hitTest on
   * pointerdown (top-down order) before the existing slot walk. Returns
   * null (or omit the callback entirely) to disable the layer pipeline —
   * legacy behavior.
   */
  getHitTestContext?: () => {
    layers: readonly RenderLayer<unknown>[];
    chromeState: ChromeState;
    view: View;
    dims: { width: number; height: number };
  } | null;
  /** Optional. Returns the scene node at the given world coords, or null
   *  for empty. The dispatcher uses this to populate `ctx.target` on
   *  pointer events (down/move/up/click/dblTap), so declarative routing
   *  factories can dispatch on target.kind ('rect'/'text'/'path'/'empty').
   *  Omit to leave the dispatcher with the always-empty fallback — see
   *  `nodeHitFor` for the rationale. */
  getNodeAtPoint?: (worldX: number, worldY: number) =>
    | { id: NodeId; kind: string; pose: unknown; data: unknown; meta?: Record<string, unknown> }
    | null;
}

interface InFlight {
  tool: AnyTool;
  scratch: unknown;
  startClient: { x: number; y: number };
  /** Hit result captured at pointerdown. Used to override the
   *  threshold-crossing pointermove's `target` for `drag.onStart` so that
   *  declarative route tables key on "where the gesture began", not "where
   *  the threshold was crossed" (which can drift off the original hit if the
   *  user moves diagonally before crossing 4px). Subsequent pointermove
   *  events use the live target so engaged-phase handlers can react to the
   *  current hit. */
  startTarget: HitResult | undefined;
  /** 'pending' = pointer down, sub-threshold (or pointer.onDown claimed for
   *  classification); 'drag' = drag.onStart fired. */
  phase: 'pending' | 'drag';
}

export interface ToolsDispatcher {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
  onWheel: (e: WheelEvent) => void;
  /** Force-cancel any in-flight gesture (used on explicit tool switch). */
  cancelGesture: () => void;
  /** Whether a gesture is currently in flight. Used by `useTools` to
   *  decide whether a modifier-key press should engage the hotkey slot
   *  (no, if mid-gesture). */
  hasActiveGesture: () => boolean;
  /** Scratch of the in-flight gesture, or `null` when idle. Exposed so
   *  consumers (cursor resolution, debug overlays) can read what the active
   *  tool is currently tracking. Read-only — do NOT mutate via this getter. */
  getActiveScratch: () => unknown;
  /** Most recent route resolution emitted by a declarative tool, or null
   *  if none has fired yet. Snapshot — safe to read on every render. */
  getLastRoute: () => RouteResolvedInfo | null;
  /** Resolve a synthetic (phase, gesture, hit, modifiers) query against the
   *  current slot occupants WITHOUT executing the matched action. Walks slots
   *  in real precedence order (hotkey > active > ambient) and consults each
   *  tool's attached `def` (the declarative `ToolDef` produced by
   *  `defineTool`). Tools without an attached `def` (imperative-only) are
   *  invisible to this query. Returns the first match, or null if no slot
   *  resolves the query. Pure: no scratch mutation, no scene mutation, no
   *  RouteResolvedInfo emission. */
  resolveOnly: (query: ResolveQuery) => ResolveResult | null;
}

/** Synthetic resolution query — what the static widget asks "if a pointer
 *  event landed on `hit` with these `modifiers`, which declarative route
 *  would the dispatcher fire in this phase + gesture?" */
export interface ResolveQuery {
  phase: 'initial' | 'engaged';
  gesture: 'click' | 'drag' | 'pointerDown' | 'dblTap' | 'wheel';
  hit: HitResult;
  modifiers: ToolModifiers;
}

/** Successful resolution: which tool, in which slot, matched which route-table
 *  key. `matchedKey` is `'*'` for function-form drag (no table to discriminate)
 *  and for wheel routes (single ActionFn). */
export interface ResolveResult {
  toolId: string;
  slot: 'hotkey' | 'active' | 'ambient';
  gesture: 'click' | 'drag' | 'pointerDown' | 'dblTap' | 'wheel';
  phase: 'initial' | 'engaged';
  matchedKey: string;
}

function ctxFor(
  scratch: unknown,
  base: Omit<ToolCtx, 'scratch'>,
  reportRoute: (info: RouteResolvedInfo) => void,
): ToolCtx {
  return { ...base, scratch, __reportRoute: reportRoute };
}

function screenPointFor(
  e: { clientX: number; clientY: number },
  canvasRect: DOMRect | undefined,
): { x: number; y: number } | undefined {
  if (!canvasRect) return undefined;
  return { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
}

function dispatchOnce<E>(
  slots: SlotsState,
  pick: (tool: AnyTool) => ((e: E, ctx: ToolCtx) => Decision) | undefined,
  event: E,
  baseCtx: Omit<ToolCtx, 'scratch'>,
  scratchFor: (tool: AnyTool) => unknown,
  reportRoute: (info: RouteResolvedInfo) => void,
): AnyTool | null {
  const order: { slot: ToolSlot; tool: AnyTool }[] = [];
  if (slots.hotkey) order.push({ slot: 'hotkey', tool: slots.hotkey });
  if (slots.active) order.push({ slot: 'active', tool: slots.active });
  for (const t of slots.ambient) order.push({ slot: 'ambient', tool: t });

  for (const { tool } of order) {
    const handler = pick(tool);
    if (!handler) continue;
    const ctx = ctxFor(scratchFor(tool), baseCtx, reportRoute);
    const decision = handler(event, ctx);
    if (decision === 'claim') return tool;
  }
  return null;
}

type PickedTable =
  | { kind: 'table'; table: RouteTable<unknown> }
  | { kind: 'functionForm' }
  | { kind: 'wheel' };

function pickTable(
  phaseDef: PhaseDef<unknown> | undefined,
  gesture: ResolveQuery['gesture'],
): PickedTable | undefined {
  if (!phaseDef) return undefined;
  switch (gesture) {
    case 'click':       return phaseDef.click ? { kind: 'table', table: phaseDef.click } : undefined;
    case 'pointerDown': return phaseDef.pointerDown ? { kind: 'table', table: phaseDef.pointerDown } : undefined;
    case 'dblTap':      return phaseDef.dblTap ? { kind: 'table', table: phaseDef.dblTap } : undefined;
    case 'drag': {
      const d = phaseDef.drag;
      if (d == null) return undefined;
      if (typeof d === 'function') return { kind: 'functionForm' };
      return { kind: 'table', table: d };
    }
    case 'wheel':
      return phaseDef.wheel != null ? { kind: 'wheel' } : undefined;
  }
}

function resolveOnlyForTool(
  tool: AnyTool,
  slot: ResolveResult['slot'],
  query: ResolveQuery,
): ResolveResult | null {
  const def = tool.def as ToolDef<unknown> | undefined;
  if (!def) return null;
  const phaseDef = (query.phase === 'engaged' ? def.engaged : def.initial) as PhaseDef<unknown> | undefined;
  const picked = pickTable(phaseDef, query.gesture);
  if (!picked) return null;
  if (picked.kind === 'functionForm' || picked.kind === 'wheel') {
    return { toolId: def.id, slot, gesture: query.gesture, phase: query.phase, matchedKey: '*' };
  }
  const match = resolveRoute(picked.table, query.hit, query.modifiers);
  if (!match) return null;
  return {
    toolId: def.id, slot, gesture: query.gesture, phase: query.phase,
    matchedKey: match.matchedKey,
  };
}

export function createToolsDispatcher(opts: ToolsDispatcherOptions): ToolsDispatcher {
  const threshold = opts.threshold ?? 4;
  const now = opts.now ?? (() => Date.now());
  const dblTapWindowMs = opts.dblTap?.windowMs ?? 300;
  const dblTapMaxDistance = opts.dblTap?.maxDistance ?? 8;
  let inFlight: InFlight | null = null;
  /** Recorded on each sub-threshold pointerup. The next sub-threshold release
   *  within `dblTapWindowMs` and `dblTapMaxDistance` of this point fires
   *  `dblTap.onTap` on the active slot order. Cleared on fire (so three taps
   *  don't stack into two dblTaps) and on any drag promotion. */
  let lastTap: { x: number; y: number; time: number } | null = null;
  /** Most recent RouteResolvedInfo emitted via ctx.__reportRoute. Updated
   *  on every successful declarative route hit; left set across gesture
   *  end / cancel so debug overlays can show "what just fired" even after
   *  the gesture closes. */
  let lastRoute: RouteResolvedInfo | null = null;
  const reportRoute = (info: RouteResolvedInfo): void => {
    lastRoute = info;
    opts.onRouteResolved?.(info);
  };

  function getInitialScratch(tool: AnyTool): unknown {
    return tool.initScratch ? tool.initScratch() : undefined;
  }

  function tryClaimsAll(tool: AnyTool, baseCtx: Omit<ToolCtx, 'scratch'>): boolean {
    if (!tool.claimsAll) return false;
    const ctx = ctxFor(getInitialScratch(tool), baseCtx, reportRoute);
    return tool.claimsAll(ctx);
  }

  function endGesture(): void {
    inFlight = null;
    opts.onGestureChange?.();
  }

  function startSlotGesture(tool: AnyTool, e: PointerEvent, baseCtx: Omit<ToolCtx, 'scratch'>): void {
    // Modal claim path: route to the tool's pointer.onDown then drag pipeline,
    // same as the legacy path. The fact that claimsAll returned true is just a
    // signal that we shouldn't have walked layers — once we're past that
    // branch, the gesture shape is identical.
    const handler = tool.pointer?.onDown;
    const initScratch = getInitialScratch(tool);
    const ctx = ctxFor(initScratch, baseCtx, reportRoute);
    let claimedScratch: unknown = initScratch;
    if (handler) {
      const decision = handler(e, ctx);
      if (decision === 'claim') {
        claimedScratch = ctx.scratch;
      }
    }
    inFlight = {
      tool,
      scratch: claimedScratch,
      startClient: { x: e.clientX, y: e.clientY },
      startTarget: baseCtx.target,
      phase: 'pending',
    };
    opts.onGestureChange?.();
  }

  function startAffordanceGesture(result: AffordanceBinding, e: PointerEvent): void {
    // Synthesize a virtual tool whose drag channel comes from the layer's
    // hit result. The dispatcher only references inFlight.tool.drag for
    // subsequent pointermove / pointerup; other Tool fields aren't
    // consulted mid-gesture, so the virtual record is sufficient.
    const virtualTool: AnyTool = {
      id: '__affordance__',
      drag: result.drag,
    } as AnyTool;
    // Build a minimal ctx for onStart. Use the same baseCtx the slot walk
    // would have used.
    const rawBaseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    // Populate ctx.target for affordance gestures — Phase 1 placeholder kind.
    const baseCtx = {
      ...rawBaseCtx,
      target: buildAffordanceTarget(result, rawBaseCtx.adapter),
      screenPoint: screenPointFor(e, rawBaseCtx.canvasRect),
    };
    const startCtx = ctxFor(result.initialScratch, baseCtx, reportRoute);
    // Affordance hits skip threshold gating — the layer already decided
    // this is a gesture, not a click. Jump straight to 'drag' phase and
    // fire onStart immediately so subsequent moves route to onMove.
    result.drag.onStart?.(e, startCtx);
    inFlight = {
      tool: virtualTool,
      // Capture any scratch mutation from onStart.
      scratch: startCtx.scratch,
      startClient: { x: e.clientX, y: e.clientY },
      startTarget: baseCtx.target,
      phase: 'drag',
    };
    opts.onGestureChange?.();
  }

  function onPointerDown(e: PointerEvent): void {
    if (inFlight) return; // ignore overlapping pointers; one gesture at a time
    const slots = opts.getSlots();
    const rawCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    // Pick the highest-priority slot tool for hitOverride consultation. Uses
    // slot order (hotkey > active > first ambient) — the same priority the
    // slot walk below follows. On pointer-down no gesture is in flight yet,
    // so the tool's initial scratch is passed to hitOverride.
    const slotToolForHit: AnyTool | undefined = slots.hotkey ?? slots.active ?? slots.ambient[0] ?? undefined;
    const baseCtx = {
      ...rawCtx,
      screenPoint: screenPointFor(e, rawCtx.canvasRect),
      target: targetFor(rawCtx, slotToolForHit, slotToolForHit ? getInitialScratch(slotToolForHit) : undefined, opts.getNodeAtPoint),
    };

    // 1. Modal claim check (hotkey > active). A tool whose state-aware
    //    `claimsAll` returns true bypasses the affordance layer pipeline
    //    entirely — used by tools mid-modal (pen mid-path, text mid-edit)
    //    where affordance hits would otherwise interrupt.
    if (slots.hotkey && tryClaimsAll(slots.hotkey, baseCtx)) {
      startSlotGesture(slots.hotkey, e, baseCtx);
      return;
    }
    if (slots.active && tryClaimsAll(slots.active, baseCtx)) {
      startSlotGesture(slots.active, e, baseCtx);
      return;
    }

    // 2. Layer hit-test pipeline. Walk visible layers top-down; first
    //    non-null AffordanceBinding routes the gesture to the layer-supplied
    //    drag channel (with optional initial scratch).
    const hitCtx = opts.getHitTestContext?.();
    if (hitCtx) {
      for (const layer of hitCtx.layers) {
        if (!layer.hitTest) continue;
        const result = layer.hitTest(
          baseCtx.worldX,
          baseCtx.worldY,
          // The dispatcher can't statically resolve TData per layer; the
          // contract is that every layer with hitTest expects ChromeState.
          hitCtx.chromeState as never,
          hitCtx.view,
          hitCtx.dims,
        );
        if (result !== null) {
          startAffordanceGesture(result, e);
          return;
        }
      }
    }

    // 3. Try pointer.onDown — classification pass. If a tool claims, it has
    //    had the opportunity to mutate ctx.scratch (e.g. stash which sub-gesture
    //    was hit). We capture the post-handler scratch so drag.* handlers see
    //    the same value. The gesture then enters `pending` phase: the drag
    //    pipeline (threshold → onStart → onMove → onEnd) still fires normally.
    //    This lets pointer.onDown act as a classification hook rather than a
    //    raw-pointer escape hatch — the pattern used by useSelectTool.
    const order: AnyTool[] = [];
    if (slots.hotkey) order.push(slots.hotkey);
    if (slots.active) order.push(slots.active);
    for (const t of slots.ambient) order.push(t);

    for (const tool of order) {
      const handler = tool.pointer?.onDown;
      if (!handler) continue;
      const initScratch = getInitialScratch(tool);
      const ctx = ctxFor(initScratch, baseCtx, reportRoute);
      const decision = handler(e, ctx);
      if (decision === 'claim') {
        // ctx.scratch may have been mutated by the handler — capture it.
        inFlight = {
          tool,
          scratch: ctx.scratch,
          startClient: { x: e.clientX, y: e.clientY },
          startTarget: baseCtx.target,
          phase: 'pending',
        };
        opts.onGestureChange?.();
        return;
      }
    }

    // 4. No pointer.onDown claim — enter pending phase. The active tool
    //    (the first in slot order with a drag or pointer.onClick handler)
    //    becomes the prospective gesture owner.
    let owner: AnyTool | null = null;
    for (const t of [slots.hotkey, slots.active, ...slots.ambient].filter(Boolean) as AnyTool[]) {
      if (t.drag || t.pointer?.onClick) { owner = t; break; }
    }
    if (!owner) return;
    inFlight = {
      tool: owner,
      scratch: getInitialScratch(owner),
      startClient: { x: e.clientX, y: e.clientY },
      startTarget: baseCtx.target,
      phase: 'pending',
    };
    opts.onGestureChange?.();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!inFlight) return;
    const rawCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    const baseCtx = {
      ...rawCtx,
      screenPoint: screenPointFor(e, rawCtx.canvasRect),
      target: targetFor(rawCtx, inFlight.tool, inFlight.scratch, opts.getNodeAtPoint),
    };

    if (inFlight.phase === 'pending') {
      const dx = e.clientX - inFlight.startClient.x;
      const dy = e.clientY - inFlight.startClient.y;
      if (dx * dx + dy * dy < threshold * threshold) return;
      // Crossed threshold: promote to drag, fire onStart with the
      // threshold-crossing event. Capture any scratch mutation onStart makes.
      // A drag also invalidates any pending dblTap anchor — a click→drag
      // sequence shouldn't latch into a dbl-tap when the drag completes.
      lastTap = null;
      // Phase 13: when the active tool has `bindingsOverrideDrag: true`, skip
      // the route-table drag channel. The new gesture dispatcher (GestureDispatcherMounter
      // via Tool.bindings) owns all drag handling for this tool.
      const skipDrag = !!(inFlight.tool as AnyTool).bindingsOverrideDrag;
      if (!skipDrag) {
        const onStart = inFlight.tool.drag?.onStart;
        if (onStart) {
          // Override the threshold-crossing target with the pointerdown target
          // captured into inFlight. Declarative routing tables key on
          // "where the gesture began" — see InFlight.startTarget JSDoc.
          const startBaseCtx = inFlight.startTarget
            ? { ...baseCtx, target: inFlight.startTarget }
            : baseCtx;
          const startCtx = ctxFor(inFlight.scratch, startBaseCtx, reportRoute);
          onStart(e, startCtx);
          inFlight.scratch = startCtx.scratch;
        }
      }
      inFlight.phase = 'drag';
      opts.onGestureChange?.();
      return;
    }

    if (inFlight.phase === 'drag') {
      const skipDrag = !!(inFlight.tool as AnyTool).bindingsOverrideDrag;
      if (!skipDrag) {
        const onMove = inFlight.tool.drag?.onMove;
        if (onMove) onMove(e, ctxFor(inFlight.scratch, baseCtx, reportRoute));
      }
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!inFlight) return;
    const rawCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    const baseCtx = {
      ...rawCtx,
      screenPoint: screenPointFor(e, rawCtx.canvasRect),
      target: targetFor(rawCtx, inFlight.tool, inFlight.scratch, opts.getNodeAtPoint),
    };

    if (inFlight.phase === 'pending') {
      // Sub-threshold release. First check whether this is the *second* tap
      // of a double-tap; if so, fire `dblTap.onTap` on the active slot order.
      // A claim suppresses `pointer.onClick`; a pass falls through to click
      // so single-click handlers still run when no tool wants the dbl-tap.
      const slots = opts.getSlots();
      let dblTapClaimed = false;
      if (lastTap !== null) {
        const dx = e.clientX - lastTap.x;
        const dy = e.clientY - lastTap.y;
        const dt = now() - lastTap.time;
        if (dt <= dblTapWindowMs && dx * dx + dy * dy <= dblTapMaxDistance * dblTapMaxDistance) {
          // Walk slot order — hotkey → active → ambient — and fire the
          // first tool whose dblTap.onTap returns 'claim'. Each tool gets a
          // fresh scratch (dblTap is not part of a drag pipeline).
          const order: AnyTool[] = [];
          if (slots.hotkey) order.push(slots.hotkey);
          if (slots.active) order.push(slots.active);
          for (const t of slots.ambient) order.push(t);
          for (const tool of order) {
            const handler = tool.dblTap?.onTap;
            if (!handler) continue;
            const ctx = ctxFor(getInitialScratch(tool), baseCtx, reportRoute);
            const decision = handler(e, ctx);
            if (decision === 'claim') {
              dblTapClaimed = true;
              break;
            }
          }
          // Whether claimed or passed, the dbl-tap event consumed lastTap —
          // a third tap shouldn't pair with the second to fire again.
          lastTap = null;
        }
      }
      if (!dblTapClaimed) {
        const onClick = inFlight.tool.pointer?.onClick;
        let claimed = false;
        if (onClick) {
          const decision = onClick(e, ctxFor(inFlight.scratch, baseCtx, reportRoute));
          claimed = decision === 'claim';
        }
        // Fallback slot: ONLY for clicks, ONLY when the active in-flight
        // tool didn't claim (no handler or returned 'pass'). Lets a non-select
        // tool stay active while unhandled clicks fall through to select for
        // click-to-select. Fallback gets a fresh scratch (no gesture context).
        if (!claimed && slots.fallback && slots.fallback !== inFlight.tool) {
          const fbHandler = slots.fallback.pointer?.onClick;
          if (fbHandler) {
            fbHandler(e, ctxFor(getInitialScratch(slots.fallback), baseCtx, reportRoute));
          }
        }
        // Record this tap as a candidate first-of-pair for the next tap.
        // (If dblTap claimed above we already cleared lastTap; recording here
        // would let three taps fire two dblTaps.)
        if (lastTap === null) {
          lastTap = { x: e.clientX, y: e.clientY, time: now() };
        }
      }
    } else if (inFlight.phase === 'drag') {
      // Phase 13: skip route-table onEnd when the new dispatcher owns drag.
      const skipDrag = !!(inFlight.tool as AnyTool).bindingsOverrideDrag;
      if (!skipDrag) {
        const onEnd = inFlight.tool.drag?.onEnd;
        if (onEnd) onEnd(e, ctxFor(inFlight.scratch, baseCtx, reportRoute));
      }
    }
    endGesture();
  }

  function keyModifiers(e: KeyboardEvent) {
    return { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey };
  }

  function onKeyDown(e: KeyboardEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx({ modifiers: keyModifiers(e) });
    dispatchOnce<KeyboardEvent>(
      slots,
      (t) => t.keyboard?.onDown,
      e,
      base,
      (t) => (inFlight && inFlight.tool === t ? inFlight.scratch : getInitialScratch(t)),
      reportRoute,
    );
  }

  function onKeyUp(e: KeyboardEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx({ modifiers: keyModifiers(e) });
    dispatchOnce<KeyboardEvent>(
      slots,
      (t) => t.keyboard?.onUp,
      e,
      base,
      (t) => (inFlight && inFlight.tool === t ? inFlight.scratch : getInitialScratch(t)),
      reportRoute,
    );
  }

  function onWheel(e: WheelEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    dispatchOnce<WheelEvent>(
      slots,
      (t) => t.wheel?.onWheel,
      e,
      base,
      (t) => (inFlight && inFlight.tool === t ? inFlight.scratch : getInitialScratch(t)),
      reportRoute,
    );
  }

  function cancelGesture(): void {
    if (!inFlight) return;
    dlog('[dispatch] cancel gesture; tool=', inFlight.tool.id, 'phase=', inFlight.phase);
    if (inFlight.phase === 'drag') {
      // Phase 13: skip route-table onCancel when the new dispatcher owns drag.
      const skipDrag = !!(inFlight.tool as AnyTool).bindingsOverrideDrag;
      if (!skipDrag) {
        const base = opts.getCtx();
        inFlight.tool.drag?.onCancel?.(ctxFor(inFlight.scratch, base, reportRoute));
      }
    }
    endGesture();
  }

  const api: ToolsDispatcher & {
    __setGetCtx?: (fn: typeof opts.getCtx) => void;
    __setHitTestContext?: (fn: typeof opts.getHitTestContext) => void;
    __setGetNodeAtPoint?: (fn: typeof opts.getNodeAtPoint) => void;
  } = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    onWheel,
    cancelGesture,
    hasActiveGesture: () => inFlight !== null,
    getActiveScratch: () => inFlight?.scratch ?? null,
    getLastRoute: () => lastRoute,
    resolveOnly: (query) => {
      const slots = opts.getSlots();
      if (slots.hotkey) {
        const r = resolveOnlyForTool(slots.hotkey, 'hotkey', query);
        if (r) return r;
      }
      if (slots.active) {
        const r = resolveOnlyForTool(slots.active, 'active', query);
        if (r) return r;
      }
      for (const t of slots.ambient) {
        const r = resolveOnlyForTool(t, 'ambient', query);
        if (r) return r;
      }
      return null;
    },
  };
  api.__setGetCtx = (fn) => { opts.getCtx = fn; };
  api.__setHitTestContext = (fn) => { opts.getHitTestContext = fn; };
  api.__setGetNodeAtPoint = (fn) => { opts.getNodeAtPoint = fn; };
  return api;
}

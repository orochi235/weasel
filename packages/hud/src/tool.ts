import type {
  Action, ActionDeps, ClaimableGesture, Contribution, InvocationCtx, View,
} from '@weasel-js/core';
import { viewToTransform, worldToScreen } from '@weasel-js/core';
import { claimsOf, type Widget, type HudPointerEvent } from './widget';

/** What the HUD layer's `hitTest` resolves and hands to the actions below. */
export interface HudHitPayload {
  widget: Widget;
}

/** Affordance kind `<SceneCanvas>` stamps on a hit from the HUD's layer:
 *  `layer:<RenderLayer.id>`, and the HUD's layer id is `weasel-hud`. */
export const HUD_AFFORDANCE_KIND = 'layer:weasel-hud';

/** Widgets decide for themselves what a modifier means, so every binding
 *  accepts any combination rather than the grammar's strict default. */
const MODS_ANY = {
  shift: 'optional', alt: 'optional', meta: 'optional', ctrl: 'optional',
} as const;

function isHudHit(hit: unknown): boolean {
  return (hit as { kind?: string } | null | undefined)?.kind === HUD_AFFORDANCE_KIND;
}

function widgetIn(affordance: unknown): Widget | null {
  return (affordance as { payload?: HudHitPayload } | null | undefined)?.payload?.widget ?? null;
}

/** A target matching a HUD hit only when the widget under it consumes this
 *  gesture. Without the claim half, a widget that declines a kind would still
 *  win it: declining leaves the claim non-exclusive, which puts the scene's
 *  binding and the HUD's own in contention at once. */
function hudHitClaiming(gesture: ClaimableGesture): (hit: unknown) => boolean {
  return Object.assign(
    (hit: unknown): boolean => {
      if (!isHudHit(hit)) return false;
      const widget = widgetIn(hit);
      return widget !== null && claimsOf(widget).includes(gesture);
    },
    { readsAffordance: true as const },
  );
}

/** World → screen, the space widgets lay themselves out in. Reads the `view`
 *  dep; without it (no viewport wired) world coords pass through. */
function toScreen(deps: ActionDeps, x: number, y: number): [number, number] {
  const view = (deps.view as { get(): View } | undefined)?.get();
  if (!view) return [x, y];
  return worldToScreen(x, y, viewToTransform(view));
}

// `HudPointerEvent.native` is `PointerEvent | null` precisely because of this
// path: the dispatcher hands actions normalized input, not the originating
// `PointerEvent`, so there is nothing truer to pass than `null`. Widgets read
// the normalized `x` / `y` and the event `type`.

function pressAction(): Action {
  return {
    id: 'hud.press',
    label: 'HUD — press widget',
    requires: ['view'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as { worldX?: number; worldY?: number; affordance?: unknown } | undefined;
        const widget = widgetIn(p?.affordance);
        if (!widget || p?.worldX === undefined || p.worldY === undefined) return;
        const [x, y] = toScreen(deps, p.worldX, p.worldY);
        widget.onPointer({ type: 'down', x, y, native: null } satisfies HudPointerEvent);
      },
    },
  };
}

function releaseAction(): Action {
  return {
    id: 'hud.release',
    label: 'HUD — release widget',
    requires: ['view'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as { pressX?: number; pressY?: number; worldX?: number; worldY?: number; affordance?: unknown } | undefined;
        const widget = widgetIn(p?.affordance);
        if (!widget || p?.worldX === undefined || p.worldY === undefined) return;
        const [x, y] = toScreen(deps, p.worldX, p.worldY);
        widget.onPointer({ type: 'up', x, y, native: null } satisfies HudPointerEvent);
      },
    },
  };
}

function dragAction(): Action {
  return {
    id: 'hud.drag',
    label: 'HUD — drag widget',
    requires: ['view'],
    invoker: {
      timing: 'ongoing' as const,
      start: (ctx: InvocationCtx) => {
        const widget = widgetIn(ctx.drag?.affordance);
        if (!widget) return {};
        // Captured here because the dispatcher builds move/end pump ctxs with
        // an empty dep bag: reading `view` off those silently skips the
        // world→screen conversion and the drag runs in the wrong space.
        const deps = ctx.deps;
        // No `down` here — `hud.press` already sent it at press time, from the
        // eager pointerdown dispatch that precedes this one.
        return {
          onMove: (moveCtx: InvocationCtx) => {
            const [x, y] = toScreen(deps, moveCtx.world.x, moveCtx.world.y);
            widget.onPointer({ type: 'move', x, y, native: null } satisfies HudPointerEvent);
          },
          onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
            if (reason === 'cancel') {
              widget.onPointer({ type: 'cancel', native: null } satisfies HudPointerEvent);
              return;
            }
            const [x, y] = toScreen(deps, endCtx.world.x, endCtx.world.y);
            widget.onPointer({ type: 'up', x, y, native: null } satisfies HudPointerEvent);
          },
        };
      },
    },
  };
}

/** The three point gestures share a shape: resolve the widget, convert the
 *  world point to screen, deliver one event. */
function pointAction(
  id: string,
  label: string,
  type: 'doubleclick' | 'contextmenu' | 'longpress',
): Action {
  return {
    id,
    label,
    requires: ['view'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as { worldX?: number; worldY?: number; affordance?: unknown } | undefined;
        const widget = widgetIn(p?.affordance);
        if (!widget || p?.worldX === undefined || p.worldY === undefined) return;
        const [x, y] = toScreen(deps, p.worldX, p.worldY);
        widget.onPointer({ type, x, y, native: null } satisfies HudPointerEvent);
      },
    },
  };
}

function wheelAction(): Action {
  return {
    id: 'hud.wheel',
    label: 'HUD — wheel over widget',
    invoker: {
      timing: 'immediate' as const,
      run: (_deps, params) => {
        const p = params as {
          clientX?: number; clientY?: number;
          deltaX?: number; deltaY?: number; affordance?: unknown;
        } | undefined;
        const widget = widgetIn(p?.affordance);
        if (!widget || p?.clientX === undefined || p.clientY === undefined) return;
        // A wheel's client coords are already canvas-local, the space widgets
        // lay out in — no view conversion, unlike the point gestures.
        widget.onPointer({
          type: 'wheel',
          x: p.clientX, y: p.clientY,
          deltaX: p.deltaX ?? 0, deltaY: p.deltaY ?? 0,
          native: null,
        } satisfies HudPointerEvent);
      },
    },
  };
}

/**
 * The HUD's input routing as a `Contribution` — bindings and actions, no
 * focus. It declares `claimed` eligibility: the HUD is chrome floating over
 * whatever tool is active, live only for input its own layer claimed.
 *
 * ```tsx
 * const hud = useHud(ref);
 * const hudContribution = useHudContribution();
 * <SceneCanvas ref={ref} ambient={[hudContribution]} … />
 * ```
 *
 * The press protocol alone spans three gesture kinds:
 *
 * - `pointerDown` sends `down` at press time, before the dispatcher knows
 *   whether this becomes a click or a drag. A button that highlights on press
 *   has to know then, not on release.
 * - `click` sends the `up` for a press that never crossed the drag threshold —
 *   the common case for a button.
 * - `drag` pumps `move` and closes with `up` / `cancel`.
 *
 * The other four are one binding each. Every binding gates on both the
 * affordance kind and the hit widget's claim set, so it fires only for input
 * the HUD's own layer claimed *and* the widget under it consumes.
 *
 * This replaces a `DragChannel` the HUD's `hitTest` used to hand back for the
 * tool-routing dispatcher to drive. That dispatcher is gone.
 */
export function createHudContribution(): Contribution {
  return {
    id: 'weasel-hud',
    eligibility: { claimed: true },
    actions: [
      pressAction(), releaseAction(), dragAction(),
      pointAction('hud.doubleClick', 'HUD — double-click widget', 'doubleclick'),
      pointAction('hud.contextMenu', 'HUD — right-click widget', 'contextmenu'),
      pointAction('hud.longPress', 'HUD — long-press widget', 'longpress'),
      wheelAction(),
    ],
    bindings: [
      { spec: { kind: 'pointerDown', target: { kindOf: hudHitClaiming('pointer') }, mods: MODS_ANY }, actionId: 'hud.press' },
      { spec: { kind: 'click', target: { kindOf: hudHitClaiming('pointer') }, mods: MODS_ANY }, actionId: 'hud.release' },
      { spec: { kind: 'drag', target: { kindOf: hudHitClaiming('pointer') }, mods: MODS_ANY }, actionId: 'hud.drag' },
      { spec: { kind: 'doubleClick', target: { kindOf: hudHitClaiming('doubleClick') }, mods: MODS_ANY }, actionId: 'hud.doubleClick' },
      { spec: { kind: 'contextMenu', target: { kindOf: hudHitClaiming('contextMenu') }, mods: MODS_ANY }, actionId: 'hud.contextMenu' },
      { spec: { kind: 'longPress', target: { kindOf: hudHitClaiming('longPress') }, mods: MODS_ANY }, actionId: 'hud.longPress' },
      { spec: { kind: 'wheel', target: { kindOf: hudHitClaiming('wheel') }, mods: MODS_ANY }, actionId: 'hud.wheel' },
    ],
  };
}

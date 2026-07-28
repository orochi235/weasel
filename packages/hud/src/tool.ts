import type { Action, ActionDeps, InvocationCtx, Tool, View } from '@weasel-js/core';
import { viewToTransform, worldToScreen } from '@weasel-js/core';
import type { Widget, HudPointerEvent } from './widget';

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

/** World → screen, the space widgets lay themselves out in. Reads the `view`
 *  dep; without it (no viewport wired) world coords pass through. */
function toScreen(deps: ActionDeps, x: number, y: number): [number, number] {
  const view = (deps.view as { get(): View } | undefined)?.get();
  if (!view) return [x, y];
  return worldToScreen(x, y, viewToTransform(view));
}

/** Synthetic DOM events for the widget protocol, which types `native` as a
 *  real event. The dispatcher hands actions normalized input, not the
 *  originating `PointerEvent`, so there is nothing truer to pass. */
function nativeStub(type: string): PointerEvent {
  return new Event(type) as PointerEvent;
}

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
        widget.onPointer({ type: 'down', x, y, native: nativeStub('pointerdown') } satisfies HudPointerEvent);
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
        widget.onPointer({ type: 'up', x, y, native: nativeStub('pointerup') } satisfies HudPointerEvent);
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
        // No `down` here — `hud.press` already sent it at press time, from the
        // eager pointerdown dispatch that precedes this one.
        return {
          onMove: (moveCtx: InvocationCtx) => {
            const [x, y] = toScreen(moveCtx.deps, moveCtx.world.x, moveCtx.world.y);
            widget.onPointer({ type: 'move', x, y, native: nativeStub('pointermove') } satisfies HudPointerEvent);
          },
          onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
            if (reason === 'cancel') {
              widget.onPointer({ type: 'cancel', native: nativeStub('pointercancel') } satisfies HudPointerEvent);
              return;
            }
            const [x, y] = toScreen(endCtx.deps, endCtx.world.x, endCtx.world.y);
            widget.onPointer({ type: 'up', x, y, native: nativeStub('pointerup') } satisfies HudPointerEvent);
          },
        };
      },
    },
  };
}

/**
 * A `Tool` carrying the HUD's input routing. Pass it to the canvas as an
 * AMBIENT tool — the HUD is chrome floating over whatever tool is active, so
 * it must not occupy the active slot:
 *
 * ```tsx
 * const hud = useHud(ref);
 * const hudTool = useHudTool();
 * <SceneCanvas ref={ref} ambient={[hudTool]} … />
 * ```
 *
 * Three bindings, because the widget protocol (`down` / `move` / `up`) spans
 * two gesture kinds:
 *
 * - `pointerDown` sends `down` at press time, before the dispatcher knows
 *   whether this becomes a click or a drag. A button that highlights on press
 *   has to know then, not on release.
 * - `click` sends the `up` for a press that never crossed the drag threshold —
 *   the common case for a button.
 * - `drag` pumps `move` and closes with `up` / `cancel`.
 *
 * All three gate on the affordance kind, so they fire only for presses the
 * HUD's own layer hit-test claimed. That gate is also why ambient scope is
 * safe: nothing else produces a `layer:weasel-hud` hit, and kit tools decline
 * presses that landed on chrome.
 *
 * This replaces a `DragChannel` the HUD's `hitTest` used to hand back for the
 * tool-routing dispatcher to drive. That dispatcher is gone.
 */
export function createHudTool(): Tool<null> {
  return {
    id: 'weasel-hud',
    actions: [pressAction(), releaseAction(), dragAction()],
    bindings: [
      { spec: { kind: 'pointerDown', target: { kindOf: isHudHit }, mods: MODS_ANY }, actionId: 'hud.press' },
      { spec: { kind: 'click', target: { kindOf: isHudHit }, mods: MODS_ANY }, actionId: 'hud.release' },
      { spec: { kind: 'drag', target: { kindOf: isHudHit }, mods: MODS_ANY }, actionId: 'hud.drag' },
    ],
  } as unknown as Tool<null>;
}

// src/tools/dispatcher.ts
import type { AnyTool, ToolCtx, ToolSlot, Decision } from './types';

interface SlotsState {
  modifier: AnyTool | null;
  active: AnyTool | null;
  alwaysOn: AnyTool[];
}

export interface ToolsDispatcherOptions {
  /** Called on every event to read the current slot occupants. The
   *  dispatcher keeps no copy — `useTools` owns slot state and updates
   *  it as the user activates / engages tools. */
  getSlots: () => SlotsState;
  /** Called once per channel-handler invocation to construct the ctx
   *  the handler receives. `<Canvas>` supplies world coords, modifiers,
   *  selection, adapter, and applyBatch; the dispatcher injects scratch. */
  getCtx: (overrides?: {
    clientX?: number;
    clientY?: number;
    modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
  }) => Omit<ToolCtx, 'scratch'>;
  /** Pixel distance the pointer must travel before a click is reclassified
   *  as a drag. Default 4. */
  threshold?: number;
}

interface InFlight {
  tool: AnyTool;
  scratch: unknown;
  startClient: { x: number; y: number };
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
   *  decide whether a modifier-key press should engage the modifier slot
   *  (no, if mid-gesture). */
  hasActiveGesture: () => boolean;
  /** Scratch of the in-flight gesture, or `null` when idle. Exposed so
   *  consumers (cursor resolution, debug overlays) can read what the active
   *  tool is currently tracking. Read-only — do NOT mutate via this getter. */
  getActiveScratch: () => unknown;
}

function ctxFor(
  scratch: unknown,
  base: Omit<ToolCtx, 'scratch'>,
): ToolCtx {
  return { ...base, scratch };
}

function dispatchOnce<E>(
  slots: SlotsState,
  pick: (tool: AnyTool) => ((e: E, ctx: ToolCtx) => Decision) | undefined,
  event: E,
  baseCtx: Omit<ToolCtx, 'scratch'>,
  scratchFor: (tool: AnyTool) => unknown,
): AnyTool | null {
  const order: { slot: ToolSlot; tool: AnyTool }[] = [];
  if (slots.modifier) order.push({ slot: 'modifier', tool: slots.modifier });
  if (slots.active) order.push({ slot: 'active', tool: slots.active });
  for (const t of slots.alwaysOn) order.push({ slot: 'alwaysOn', tool: t });

  for (const { tool } of order) {
    const handler = pick(tool);
    if (!handler) continue;
    const ctx = ctxFor(scratchFor(tool), baseCtx);
    const decision = handler(event, ctx);
    if (decision === 'claim') return tool;
  }
  return null;
}

export function createToolsDispatcher(opts: ToolsDispatcherOptions): ToolsDispatcher {
  const threshold = opts.threshold ?? 4;
  let inFlight: InFlight | null = null;

  function getInitialScratch(tool: AnyTool): unknown {
    return tool.initScratch ? tool.initScratch() : undefined;
  }

  function endGesture(): void {
    inFlight = null;
  }

  function onPointerDown(e: PointerEvent): void {
    if (inFlight) return; // ignore overlapping pointers; one gesture at a time
    const slots = opts.getSlots();
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });

    // 1. Try pointer.onDown — classification pass. If a tool claims, it has
    //    had the opportunity to mutate ctx.scratch (e.g. stash which sub-gesture
    //    was hit). We capture the post-handler scratch so drag.* handlers see
    //    the same value. The gesture then enters `pending` phase: the drag
    //    pipeline (threshold → onStart → onMove → onEnd) still fires normally.
    //    This lets pointer.onDown act as a classification hook rather than a
    //    raw-pointer escape hatch — the pattern used by useSelectTool.
    const order: AnyTool[] = [];
    if (slots.modifier) order.push(slots.modifier);
    if (slots.active) order.push(slots.active);
    for (const t of slots.alwaysOn) order.push(t);

    for (const tool of order) {
      const handler = tool.pointer?.onDown;
      if (!handler) continue;
      const initScratch = getInitialScratch(tool);
      const ctx = ctxFor(initScratch, baseCtx);
      const decision = handler(e, ctx);
      if (decision === 'claim') {
        // ctx.scratch may have been mutated by the handler — capture it.
        inFlight = {
          tool,
          scratch: ctx.scratch,
          startClient: { x: e.clientX, y: e.clientY },
          phase: 'pending',
        };
        return;
      }
    }

    // 2. No pointer.onDown claim — enter pending phase. The active tool
    //    (the first in slot order with a drag or pointer.onClick handler)
    //    becomes the prospective gesture owner.
    let owner: AnyTool | null = null;
    for (const t of [slots.modifier, slots.active, ...slots.alwaysOn].filter(Boolean) as AnyTool[]) {
      if (t.drag || t.pointer?.onClick) { owner = t; break; }
    }
    if (!owner) return;
    inFlight = {
      tool: owner,
      scratch: getInitialScratch(owner),
      startClient: { x: e.clientX, y: e.clientY },
      phase: 'pending',
    };
  }

  function onPointerMove(e: PointerEvent): void {
    if (!inFlight) return;
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });

    if (inFlight.phase === 'pending') {
      const dx = e.clientX - inFlight.startClient.x;
      const dy = e.clientY - inFlight.startClient.y;
      if (dx * dx + dy * dy < threshold * threshold) return;
      // Crossed threshold: promote to drag, fire onStart with the
      // threshold-crossing event. Capture any scratch mutation onStart makes.
      const onStart = inFlight.tool.drag?.onStart;
      if (onStart) {
        const startCtx = ctxFor(inFlight.scratch, baseCtx);
        onStart(e, startCtx);
        inFlight.scratch = startCtx.scratch;
      }
      inFlight.phase = 'drag';
      return;
    }

    if (inFlight.phase === 'drag') {
      const onMove = inFlight.tool.drag?.onMove;
      if (onMove) onMove(e, ctxFor(inFlight.scratch, baseCtx));
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!inFlight) return;
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });

    if (inFlight.phase === 'pending') {
      // Sub-threshold release → click.
      const onClick = inFlight.tool.pointer?.onClick;
      if (onClick) onClick(e, ctxFor(inFlight.scratch, baseCtx));
    } else if (inFlight.phase === 'drag') {
      const onEnd = inFlight.tool.drag?.onEnd;
      if (onEnd) onEnd(e, ctxFor(inFlight.scratch, baseCtx));
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
    );
  }

  function cancelGesture(): void {
    if (!inFlight) return;
    if (inFlight.phase === 'drag') {
      const base = opts.getCtx();
      inFlight.tool.drag?.onCancel?.(ctxFor(inFlight.scratch, base));
    }
    endGesture();
  }

  const api: ToolsDispatcher & { __setGetCtx?: (fn: typeof opts.getCtx) => void } = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    onWheel,
    cancelGesture,
    hasActiveGesture: () => inFlight !== null,
    getActiveScratch: () => inFlight?.scratch ?? null,
  };
  api.__setGetCtx = (fn) => { opts.getCtx = fn; };
  return api;
}

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
  getCtx: (overrides?: { worldX?: number; worldY?: number }) => Omit<ToolCtx, 'scratch'>;
  /** Pixel distance the pointer must travel before a click is reclassified
   *  as a drag. Default 4. */
  threshold?: number;
}

interface InFlight {
  tool: AnyTool;
  scratch: unknown;
  startClient: { x: number; y: number };
  /** 'pending' = pointer down, sub-threshold; 'drag' = drag.onStart fired;
   *  'pointer-claimed' = pointer.onDown returned 'claim'. */
  phase: 'pending' | 'drag' | 'pointer-claimed';
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
    const baseCtx = opts.getCtx({ worldX: e.clientX, worldY: e.clientY });

    // 1. Try pointer.onDown — escape hatch. If it claims, we lock the
    //    gesture into 'pointer-claimed' phase: subsequent moves/ups still
    //    fire pointer/drag handlers on the same tool, but neither click
    //    nor drag.onStart will ever be triggered.
    const claimedByDown = dispatchOnce<PointerEvent>(
      slots,
      (t) => t.pointer?.onDown,
      e,
      baseCtx,
      (t) => getInitialScratch(t),
    );
    if (claimedByDown) {
      inFlight = {
        tool: claimedByDown,
        scratch: getInitialScratch(claimedByDown),
        startClient: { x: e.clientX, y: e.clientY },
        phase: 'pointer-claimed',
      };
      return;
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
    const baseCtx = opts.getCtx({ worldX: e.clientX, worldY: e.clientY });

    if (inFlight.phase === 'pending') {
      const dx = e.clientX - inFlight.startClient.x;
      const dy = e.clientY - inFlight.startClient.y;
      if (dx * dx + dy * dy < threshold * threshold) return;
      // Crossed threshold: promote to drag, fire onStart with the
      // threshold-crossing event.
      const onStart = inFlight.tool.drag?.onStart;
      if (onStart) {
        onStart(e, ctxFor(inFlight.scratch, baseCtx));
      }
      inFlight.phase = 'drag';
      return;
    }

    if (inFlight.phase === 'drag') {
      const onMove = inFlight.tool.drag?.onMove;
      if (onMove) onMove(e, ctxFor(inFlight.scratch, baseCtx));
      return;
    }

    // 'pointer-claimed' — no drag promotion; raw pointer events keep flowing
    // but there's no 'onMove' on pointer channel (escape-hatch users handle
    // their own move logic). No-op here.
  }

  function onPointerUp(e: PointerEvent): void {
    if (!inFlight) return;
    const baseCtx = opts.getCtx({ worldX: e.clientX, worldY: e.clientY });

    if (inFlight.phase === 'pending') {
      // Sub-threshold release → click.
      const onClick = inFlight.tool.pointer?.onClick;
      if (onClick) onClick(e, ctxFor(inFlight.scratch, baseCtx));
    } else if (inFlight.phase === 'drag') {
      const onEnd = inFlight.tool.drag?.onEnd;
      if (onEnd) onEnd(e, ctxFor(inFlight.scratch, baseCtx));
    }
    // 'pointer-claimed' has no commit semantic at this layer.
    endGesture();
  }

  function onKeyDown(e: KeyboardEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx();
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
    const base = opts.getCtx();
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
    const base = opts.getCtx({ worldX: e.clientX, worldY: e.clientY });
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
  };
  api.__setGetCtx = (fn) => { opts.getCtx = fn; };
  return api;
}

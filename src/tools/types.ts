// src/tools/types.ts
import type { SelectionApi } from '../features/selection/useSelection';
import type { Op } from '../core/ops/types';

/** Outcome of a channel handler. `'claim'` stops dispatch for this event;
 *  `'pass'` lets the next slot try. Handlers that return nothing are
 *  treated as `'pass'`. */
export type Decision = 'claim' | 'pass' | void;

/** Modifier-key snapshot at event dispatch time. `space` is included
 *  because tools commonly use space as a modifier-slot trigger and may
 *  also want to read it as a flag mid-gesture. */
export interface ToolModifiers {
  alt: boolean;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
  space: boolean;
}

/** Per-event context passed to every channel handler. `scratch` is typed
 *  via the tool's `TScratch` parameter; it survives across a single
 *  gesture (pointer-down through end/cancel) and is replaced on next
 *  gesture start by `initScratch()`. */
export interface ToolCtx<TScratch = unknown> {
  worldX: number;
  worldY: number;
  modifiers: ToolModifiers;
  selection: SelectionApi;
  /** Adapter/scene access — opaque at this layer; tools that need it
   *  cast to a known shape. Phase 1 doesn't constrain this. */
  adapter: unknown;
  applyBatch: (ops: Op[], label: string) => void;
  scratch: TScratch;
}

export interface PointerChannel<TScratch> {
  onDown?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onClick?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
}

export interface DragChannel<TScratch> {
  onStart?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onMove?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onEnd?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  onCancel?: (ctx: ToolCtx<TScratch>) => void;
}

export interface KeyboardChannel<TScratch> {
  onDown?: (e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision;
  onUp?: (e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision;
}

export interface WheelChannel<TScratch> {
  onWheel?: (e: WheelEvent, ctx: ToolCtx<TScratch>) => Decision;
}

/** Modifier-slot trigger key. `null` (or omitted) means the tool is
 *  not eligible for the modifier slot. */
export type ModifierTrigger = 'space' | 'alt' | 'ctrl' | 'meta' | 'shift';

/** Full Tool record. */
export interface Tool<TScratch = unknown> {
  id: string;
  keybinding?: string;
  modifier?: ModifierTrigger;
  initScratch?: () => TScratch;
  onActivate?: (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  pointer?: PointerChannel<TScratch>;
  drag?: DragChannel<TScratch>;
  keyboard?: KeyboardChannel<TScratch>;
  wheel?: WheelChannel<TScratch>;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
}

/** Internal — which slot a tool occupies in the dispatch order. */
export type ToolSlot = 'modifier' | 'active' | 'alwaysOn';

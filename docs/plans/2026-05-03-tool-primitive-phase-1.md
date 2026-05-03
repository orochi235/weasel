# Tool Primitive Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundation substrate for the Tool primitive: `defineTool`, `useTools`, `useKeybindings`, the `Tool` / `ToolCtx` / `Decision` types, and the `<Canvas tools={tools} />` prop with a passthrough fallback to the existing hook-based gesture wiring.

**Architecture:** A new `src/tools/` directory houses the substrate. `useTools` constructs an immutable registry + reactive active-tool state and exposes a dispatcher object. The dispatcher is what `<Canvas>` actually wires to its DOM events; it walks `modifier → active → always-on` and routes through four channels (`pointer`, `drag`, `keyboard`, `wheel`). Threshold-gated drag-vs-click disambiguation and per-gesture scratch live inside the dispatcher. When the consumer passes `tools` to `<Canvas>`, the dispatcher's pointer bindings replace the existing `usePointerGestures` bindings; the action-gesture (delete/nudge/etc.) hooks remain wired in parallel for now (they get folded into always-on tools in Phase 2). When `tools` is omitted, `<Canvas>` falls back to the legacy gesture wiring unchanged.

**Tech Stack:** TypeScript, React 19, Vitest, jsdom.

**Reference spec:** `docs/specs/2026-05-03-tool-primitive-design.md`.

**Out of scope (Phase 2+):**
- Any built-in tool implementation (`select`, `hand`, `insert`, action tools).
- Demo migration off `gestures` / `tool` props.
- Deletion of `useMove` / `useResize` / `useRotate` / `useInsert` / `useAreaSelect` / `useEditAnchors` from the public surface.
- Cursor-override map (cursor propagation from active tool to canvas style stays Phase 1; the registry-level override map is deferred).

---

## File Structure

### New files (tools substrate)

```
src/tools/types.ts                    # Tool, ToolCtx, Decision, Channels, ToolSlot
src/tools/defineTool.ts               # defineTool<TScratch>(spec) — identity helper that infers TScratch
src/tools/useTools.ts                 # useTools({ active, registry, alwaysOn }) → ToolsApi
src/tools/useTools.test.ts
src/tools/useKeybindings.ts           # useKeybindings(tools, options?) — wires kb to setActive
src/tools/useKeybindings.test.ts
src/tools/dispatcher.ts               # createToolsDispatcher — event-routing engine
src/tools/dispatcher.test.ts
src/tools/index.ts                    # barrel
```

### Modified files

```
src/canvas/Canvas.tsx                 # accept `tools` prop; bypass usePointerGestures bindings when present
src/canvas/Canvas.test.tsx            # add tools-mode passthrough tests
src/index.ts                          # re-export tools/* public API
```

### Why this shape

- **One file per primary export.** `useTools`, `useKeybindings`, dispatcher are conceptually separable; coupling them in one file would make each harder to read.
- **Dispatcher is its own module** (not inlined into `useTools`) because it's pure logic (no React) and benefits from being unit-testable without rendering. `useTools` constructs it once and exposes it.
- **Types live in `types.ts`** so consumer code can import types without dragging the runtime hooks in.

---

## Task 1: Tool / ToolCtx / Decision types

**Files:**
- Create: `src/tools/types.ts`

- [ ] **Step 1: Write the type definitions**

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/tools/types.ts
git commit -m "feat(tools): Tool / ToolCtx / Decision type substrate"
```

---

## Task 2: defineTool identity helper

**Files:**
- Create: `src/tools/defineTool.ts`
- Create: `src/tools/defineTool.test.ts`

`defineTool` exists so consumers don't have to spell out the `Tool<TScratch>` type argument; TypeScript infers it from `initScratch`'s return type.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/defineTool.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import { defineTool } from './defineTool';

describe('defineTool', () => {
  it('returns the spec unchanged at runtime', () => {
    const spec = { id: 'foo' as const };
    const tool = defineTool(spec);
    expect(tool).toBe(spec);
  });

  it('infers TScratch from initScratch return type', () => {
    const tool = defineTool({
      id: 'pen',
      initScratch: () => ({ anchors: [] as { x: number; y: number }[] }),
      drag: {
        onMove: (_e, ctx) => {
          // If TScratch is properly inferred, ctx.scratch.anchors is typed.
          expectTypeOf(ctx.scratch.anchors).toEqualTypeOf<{ x: number; y: number }[]>();
          return 'claim';
        },
      },
    });
    expect(tool.id).toBe('pen');
  });

  it('defaults TScratch to undefined when initScratch is omitted', () => {
    const tool = defineTool({
      id: 'hand',
      drag: {
        onStart: (_e, ctx) => {
          expectTypeOf(ctx.scratch).toEqualTypeOf<undefined>();
          return 'claim';
        },
      },
    });
    expect(tool.id).toBe('hand');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tools/defineTool.test.ts`
Expected: FAIL — `defineTool` not found.

- [ ] **Step 3: Implement defineTool**

```ts
// src/tools/defineTool.ts
import type { Tool } from './types';

/**
 * Identity helper for declaring a `Tool`. Exists for TypeScript inference:
 * passing the spec directly to a generic site loses `TScratch` inference, so
 * authors would have to spell out the type argument.
 *
 *   const pen = defineTool({
 *     id: 'pen',
 *     initScratch: () => ({ anchors: [] as Point[] }),
 *     drag: { onMove: (e, ctx) => { ctx.scratch.anchors.push(...); return 'claim'; } },
 *   });
 */
export function defineTool<TScratch = undefined>(
  spec: Tool<TScratch>,
): Tool<TScratch> {
  return spec;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tools/defineTool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/defineTool.ts src/tools/defineTool.test.ts
git commit -m "feat(tools): defineTool identity helper"
```

---

## Task 3: Dispatcher — pure event-routing engine (slot order + threshold gate)

**Files:**
- Create: `src/tools/dispatcher.ts`
- Create: `src/tools/dispatcher.test.ts`

The dispatcher is a framework-agnostic class that wraps the runtime state of a tools registry — which tool is in each slot, which gesture (if any) is in flight, the current scratch — and exposes methods that map raw DOM events to channel handlers.

It does NOT attach any DOM listeners itself. `<Canvas>` (and the tests) call its methods (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onKeyDown`, etc.) and the dispatcher decides which tool's handler to invoke.

This task lands the dispatcher with the full slot/channel routing and threshold-gated drag/click disambiguation. Activation/modifier engagement live in Task 4 (`useTools`); the dispatcher takes the per-slot tool list as an injected getter.

- [ ] **Step 1: Write the failing tests**

```ts
// src/tools/dispatcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import { defineTool } from './defineTool';
import type { Tool, ToolCtx } from './types';

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { get: () => [], set: () => {}, add: () => {}, remove: () => {}, toggle: () => {}, clear: () => {}, applyClick: () => {} } as never,
    adapter: null,
    applyBatch: () => {},
    scratch: undefined,
    ...over,
  };
}

function pointerEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { clientX: 0, clientY: 0, pointerId: 1, ...init });
}

interface SlotsState {
  modifier: Tool | null;
  active: Tool | null;
  alwaysOn: Tool[];
}

function makeDispatcher(slots: SlotsState): ToolsDispatcher {
  return createToolsDispatcher({
    getSlots: () => slots,
    getCtx: makeCtx,
    threshold: 4,
  });
}

describe('dispatcher: slot order', () => {
  it('walks modifier → active → alwaysOn for keyboard events', () => {
    const order: string[] = [];
    const make = (id: string, decision: 'claim' | 'pass') =>
      defineTool({
        id,
        keyboard: { onDown: () => { order.push(id); return decision; } },
      });

    const d = makeDispatcher({
      modifier: make('modA', 'pass'),
      active: make('actA', 'pass'),
      alwaysOn: [make('always1', 'pass'), make('always2', 'claim')],
    });

    d.onKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(order).toEqual(['modA', 'actA', 'always1', 'always2']);
  });

  it('stops dispatch when a slot claims', () => {
    const order: string[] = [];
    const make = (id: string, decision: 'claim' | 'pass') =>
      defineTool({
        id,
        keyboard: { onDown: () => { order.push(id); return decision; } },
      });

    const d = makeDispatcher({
      modifier: make('modA', 'claim'),
      active: make('actA', 'claim'),
      alwaysOn: [],
    });

    d.onKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(order).toEqual(['modA']);
  });
});

describe('dispatcher: threshold-gated drag', () => {
  it('routes sub-threshold release to pointer.onClick', () => {
    const onClick = vi.fn(() => 'claim' as const);
    const onDragStart = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick },
      drag: { onStart: onDragStart },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 102, clientY: 101 }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('routes post-threshold movement to drag.onStart/onMove/onEnd', () => {
    const onClick = vi.fn(() => 'claim' as const);
    const onStart = vi.fn(() => 'claim' as const);
    const onMove = vi.fn(() => 'claim' as const);
    const onEnd = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onClick },
      drag: { onStart, onMove, onEnd },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 110, clientY: 100 })); // crosses threshold
    d.onPointerMove(pointerEvent('pointermove', { clientX: 120, clientY: 100 }));
    d.onPointerUp(pointerEvent('pointerup', { clientX: 120, clientY: 100 }));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledOnce(); // the second move (the threshold-crossing one is consumed by onStart)
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('pointer.onDown is the escape hatch — fires before threshold and suppresses drag/click when claimed', () => {
    const onDown = vi.fn(() => 'claim' as const);
    const onClick = vi.fn(() => 'claim' as const);
    const onStart = vi.fn(() => 'claim' as const);
    const tool = defineTool({
      id: 't',
      pointer: { onDown, onClick },
      drag: { onStart },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    expect(onDown).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('dispatcher: scratch lifecycle', () => {
  it('initializes scratch on gesture start and persists across moves', () => {
    const scratchSeen: unknown[] = [];
    const tool = defineTool({
      id: 't',
      initScratch: () => ({ count: 0 }),
      drag: {
        onStart: (_e, ctx) => { ctx.scratch.count = 1; scratchSeen.push({ ...ctx.scratch }); return 'claim'; },
        onMove:  (_e, ctx) => { ctx.scratch.count++; scratchSeen.push({ ...ctx.scratch }); return 'claim'; },
        onEnd:   (_e, ctx) => { scratchSeen.push({ ...ctx.scratch }); return 'claim'; },
      },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 60, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    expect(scratchSeen).toEqual([{ count: 1 }, { count: 2 }, { count: 2 }]);
  });

  it('replaces scratch on the next gesture', () => {
    const scratches: number[] = [];
    let i = 0;
    const tool = defineTool({
      id: 't',
      initScratch: () => ({ id: ++i }),
      drag: {
        onStart: (_e, ctx) => { scratches.push(ctx.scratch.id); return 'claim'; },
      },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.onPointerUp(pointerEvent('pointerup'));

    expect(scratches).toEqual([1, 2]);
  });
});

describe('dispatcher: cancelGesture', () => {
  it('invokes drag.onCancel on the in-flight tool, discards scratch', () => {
    const onCancel = vi.fn();
    const tool = defineTool({
      id: 't',
      initScratch: () => ({}),
      drag: {
        onStart: () => 'claim',
        onCancel,
      },
    });
    const d = makeDispatcher({ modifier: null, active: tool, alwaysOn: [] });

    d.onPointerDown(pointerEvent('pointerdown'));
    d.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    d.cancelGesture();

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/tools/dispatcher.test.ts`
Expected: FAIL — `dispatcher` module not found.

- [ ] **Step 3: Implement the dispatcher**

```ts
// src/tools/dispatcher.ts
import type { Tool, ToolCtx, ToolSlot, Decision } from './types';

interface SlotsState {
  modifier: Tool | null;
  active: Tool | null;
  alwaysOn: Tool[];
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
  tool: Tool;
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
  tool: Tool,
  scratch: unknown,
  base: Omit<ToolCtx, 'scratch'>,
): ToolCtx {
  return { ...base, scratch };
}

function dispatchOnce<E>(
  slots: SlotsState,
  channel: 'pointer' | 'drag' | 'keyboard' | 'wheel',
  pick: (tool: Tool) => ((e: E, ctx: ToolCtx) => Decision) | undefined,
  event: E,
  baseCtx: Omit<ToolCtx, 'scratch'>,
  scratchFor: (tool: Tool) => unknown,
): Tool | null {
  const order: { slot: ToolSlot; tool: Tool }[] = [];
  if (slots.modifier) order.push({ slot: 'modifier', tool: slots.modifier });
  if (slots.active) order.push({ slot: 'active', tool: slots.active });
  for (const t of slots.alwaysOn) order.push({ slot: 'alwaysOn', tool: t });

  for (const { tool } of order) {
    const handler = pick(tool);
    if (!handler) continue;
    const ctx = ctxFor(tool, scratchFor(tool), baseCtx);
    const decision = handler(event, ctx);
    if (decision === 'claim') return tool;
  }
  return null;
}

export function createToolsDispatcher(opts: ToolsDispatcherOptions): ToolsDispatcher {
  const threshold = opts.threshold ?? 4;
  let inFlight: InFlight | null = null;

  function getInitialScratch(tool: Tool): unknown {
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
      'pointer',
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
    let owner: Tool | null = null;
    for (const t of [slots.modifier, slots.active, ...slots.alwaysOn].filter(Boolean) as Tool[]) {
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
        onStart(e, ctxFor(inFlight.tool, inFlight.scratch, baseCtx));
      }
      inFlight.phase = 'drag';
      return;
    }

    if (inFlight.phase === 'drag') {
      const onMove = inFlight.tool.drag?.onMove;
      if (onMove) onMove(e, ctxFor(inFlight.tool, inFlight.scratch, baseCtx));
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
      if (onClick) onClick(e, ctxFor(inFlight.tool, inFlight.scratch, baseCtx));
    } else if (inFlight.phase === 'drag') {
      const onEnd = inFlight.tool.drag?.onEnd;
      if (onEnd) onEnd(e, ctxFor(inFlight.tool, inFlight.scratch, baseCtx));
    }
    // 'pointer-claimed' has no commit semantic at this layer.
    endGesture();
  }

  function onKeyDown(e: KeyboardEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx();
    dispatchOnce<KeyboardEvent>(
      slots,
      'keyboard',
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
      'keyboard',
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
      'wheel',
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
      inFlight.tool.drag?.onCancel?.(ctxFor(inFlight.tool, inFlight.scratch, base));
    }
    endGesture();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    onWheel,
    cancelGesture,
    hasActiveGesture: () => inFlight !== null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/tools/dispatcher.test.ts`
Expected: PASS — all six test cases.

- [ ] **Step 5: Commit**

```bash
git add src/tools/dispatcher.ts src/tools/dispatcher.test.ts
git commit -m "feat(tools): event-routing dispatcher with slot order + threshold-gated drag"
```

---

## Task 4: useTools hook (registry + active state + slot routing)

**Files:**
- Create: `src/tools/useTools.ts`
- Create: `src/tools/useTools.test.ts`

`useTools` constructs the dispatcher, owns the reactive `active` state, tracks modifier-slot engagement, and exposes a `ToolsApi` for `<Canvas>` and userland UI.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/tools/useTools.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTools } from './useTools';
import { defineTool } from './defineTool';

describe('useTools', () => {
  it('exposes active id and setActive', () => {
    const select = defineTool({ id: 'select' });
    const pen    = defineTool({ id: 'pen' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, pen } }),
    );

    expect(result.current.active).toBe('select');
    act(() => result.current.setActive('pen'));
    expect(result.current.active).toBe('pen');
  });

  it('tracks modifier-slot engagement', () => {
    const hand = defineTool({ id: 'hand', modifier: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), hand } }),
    );

    expect(result.current.modifierEngaged).toBe(null);
    act(() => result.current.engageModifier('hand'));
    expect(result.current.modifierEngaged).toBe('hand');
    act(() => result.current.disengageModifier());
    expect(result.current.modifierEngaged).toBe(null);
  });

  it('throws when active id is not in registry', () => {
    expect(() =>
      renderHook(() =>
        useTools({ active: 'nope', registry: { select: defineTool({ id: 'select' }) } }),
      ),
    ).toThrow(/registry/i);
  });

  it('exposes always-on tool list', () => {
    const del = defineTool({ id: 'delete' });
    const nudge = defineTool({ id: 'nudge' });
    const { result } = renderHook(() =>
      useTools({
        active: 'select',
        registry: { select: defineTool({ id: 'select' }) },
        alwaysOn: [del, nudge],
      }),
    );

    expect(result.current.alwaysOn.map((t) => t.id)).toEqual(['delete', 'nudge']);
  });

  it('explicit setActive cancels in-flight gesture', () => {
    const onCancel = vi.fn();
    const select = defineTool({
      id: 'select',
      drag: { onStart: () => 'claim', onCancel },
    });
    const pen = defineTool({ id: 'pen' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, pen } }),
    );
    const d = result.current.dispatcher;

    d.onPointerDown(new PointerEvent('pointerdown', { pointerId: 1 }));
    d.onPointerMove(new PointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }));
    expect(d.hasActiveGesture()).toBe(true);

    act(() => result.current.setActive('pen'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(d.hasActiveGesture()).toBe(false);
  });

  it('engageModifier is a no-op while a gesture is in flight', () => {
    const select = defineTool({
      id: 'select',
      drag: { onStart: () => 'claim' },
    });
    const hand = defineTool({ id: 'hand', modifier: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, hand } }),
    );
    const d = result.current.dispatcher;

    d.onPointerDown(new PointerEvent('pointerdown', { pointerId: 1 }));
    d.onPointerMove(new PointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }));

    act(() => result.current.engageModifier('hand'));
    expect(result.current.modifierEngaged).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/tools/useTools.test.ts`
Expected: FAIL — `useTools` not found.

- [ ] **Step 3: Implement useTools**

```ts
// src/tools/useTools.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import type { Tool, ToolCtx } from './types';

export interface UseToolsOptions {
  /** Initial active-slot tool id. Must exist in `registry`. */
  active: string;
  /** Tools eligible for the active slot or modifier slot. The keys are the
   *  tool ids; the values are the tool records. A tool with `modifier` set
   *  is wired into the modifier slot whenever the engagement state matches. */
  registry: Record<string, Tool>;
  /** Always-on tools — listen continuously regardless of active slot. */
  alwaysOn?: Tool[];
  /** Per-event base ctx supplier. `<Canvas>` wires this to inject world
   *  coords, modifiers, selection, adapter, applyBatch. Tests can supply
   *  a stub. Optional — the dispatcher works with a default empty ctx
   *  for tests that don't need the wiring. */
  getCtx?: () => Omit<ToolCtx, 'scratch'>;
}

export interface ToolsApi {
  /** Current active-slot tool id. */
  active: string;
  /** Set the active-slot tool. Cancels any in-flight gesture. */
  setActive: (id: string) => void;
  /** Currently modifier-engaged tool id (or `null`). */
  modifierEngaged: string | null;
  /** Engage a modifier-slot tool by id. No-op if a gesture is in flight. */
  engageModifier: (id: string) => void;
  /** Disengage the modifier-slot tool, if any. */
  disengageModifier: () => void;
  /** All always-on tools, in registration order. */
  alwaysOn: readonly Tool[];
  /** Full registry — for userland UI (palette buttons, etc.). */
  registry: Readonly<Record<string, Tool>>;
  /** The dispatcher `<Canvas>` wires to its DOM events. */
  dispatcher: ToolsDispatcher;
}

const DEFAULT_CTX: Omit<ToolCtx, 'scratch'> = {
  worldX: 0,
  worldY: 0,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
  selection: {
    get: () => [], set: () => {}, add: () => {}, remove: () => {},
    toggle: () => {}, clear: () => {}, applyClick: () => {},
  } as never,
  adapter: null,
  applyBatch: () => {},
};

export function useTools(opts: UseToolsOptions): ToolsApi {
  if (!(opts.active in opts.registry)) {
    throw new Error(`useTools: active "${opts.active}" not in registry`);
  }

  const [active, setActiveState] = useState<string>(opts.active);
  const [modifierEngaged, setModifierEngaged] = useState<string | null>(null);

  // Refs so the dispatcher's getSlots/getCtx callbacks see latest values
  // without re-creating the dispatcher.
  const registryRef = useRef(opts.registry);
  registryRef.current = opts.registry;
  const alwaysOnRef = useRef(opts.alwaysOn ?? []);
  alwaysOnRef.current = opts.alwaysOn ?? [];
  const activeRef = useRef(active);
  activeRef.current = active;
  const modifierRef = useRef(modifierEngaged);
  modifierRef.current = modifierEngaged;
  const getCtxRef = useRef(opts.getCtx);
  getCtxRef.current = opts.getCtx;

  const dispatcher = useMemo(
    () =>
      createToolsDispatcher({
        getSlots: () => ({
          modifier: modifierRef.current ? registryRef.current[modifierRef.current] ?? null : null,
          active: registryRef.current[activeRef.current] ?? null,
          alwaysOn: alwaysOnRef.current,
        }),
        getCtx: (overrides) => {
          const base = getCtxRef.current ? getCtxRef.current() : DEFAULT_CTX;
          return overrides ? { ...base, ...overrides } : base;
        },
      }),
    [],
  );

  const setActive = useCallback(
    (id: string) => {
      if (!(id in registryRef.current)) {
        throw new Error(`setActive: "${id}" not in registry`);
      }
      dispatcher.cancelGesture();
      setActiveState(id);
    },
    [dispatcher],
  );

  const engageModifier = useCallback(
    (id: string) => {
      if (dispatcher.hasActiveGesture()) return; // mid-gesture lockout
      if (!(id in registryRef.current)) {
        throw new Error(`engageModifier: "${id}" not in registry`);
      }
      setModifierEngaged(id);
    },
    [dispatcher],
  );

  const disengageModifier = useCallback(() => {
    setModifierEngaged(null);
  }, []);

  return {
    active,
    setActive,
    modifierEngaged,
    engageModifier,
    disengageModifier,
    alwaysOn: alwaysOnRef.current,
    registry: registryRef.current,
    dispatcher,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/tools/useTools.test.ts`
Expected: PASS — all six test cases.

- [ ] **Step 5: Commit**

```bash
git add src/tools/useTools.ts src/tools/useTools.test.ts
git commit -m "feat(tools): useTools hook (registry, active state, modifier engagement)"
```

---

## Task 5: useKeybindings hook

**Files:**
- Create: `src/tools/useKeybindings.ts`
- Create: `src/tools/useKeybindings.test.ts`

`useKeybindings` walks the registry, reads each tool's `keybinding` field, and wires document-level keydown listeners. Tools with `modifier` get keydown→engage / keyup→disengage handlers. Tools with `keybinding` get a keydown→setActive handler.

Re-uses `isEditableTarget` from the existing `useKeybinding` hook to skip when focus is in a text input.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/tools/useKeybindings.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './defineTool';

function press(key: string, type: 'keydown' | 'keyup' = 'keydown'): void {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

describe('useKeybindings', () => {
  it('switches active tool on keybinding press', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    });

    expect(result.current.active).toBe('select');
    act(() => press('p'));
    expect(result.current.active).toBe('pen');
    act(() => press('v'));
    expect(result.current.active).toBe('select');
  });

  it('engages modifier-slot tool on modifier-key down, disengages on key-up', () => {
    const select = defineTool({ id: 'select' });
    const hand   = defineTool({ id: 'hand', modifier: 'space' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return tools;
    });

    expect(result.current.modifierEngaged).toBe(null);
    act(() => press(' ', 'keydown'));
    expect(result.current.modifierEngaged).toBe('hand');
    act(() => press(' ', 'keyup'));
    expect(result.current.modifierEngaged).toBe(null);
  });

  it('overrides remap a key to a different tool', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { overrides: { v: 'pen' } });
      return tools;
    });

    act(() => press('v'));
    expect(result.current.active).toBe('pen');
  });

  it('disable: true skips all wiring', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { disable: true });
      return tools;
    });

    act(() => press('p'));
    expect(result.current.active).toBe('select');
  });

  it('skips when focus is in an editable element', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    document.body.removeChild(input);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/tools/useKeybindings.test.ts`
Expected: FAIL — `useKeybindings` not found.

- [ ] **Step 3: Implement useKeybindings**

```ts
// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import { isEditableTarget } from '../interactions/actions/useKeybinding';
import type { ToolsApi } from './useTools';
import type { ModifierTrigger } from './types';

export interface UseKeybindingsOptions {
  /** Override map: physical key → tool id. Wins over the tool's declared
   *  keybinding. Pass `null` as the value to unbind a key entirely. */
  overrides?: Record<string, string | null>;
  /** Skip all wiring. Useful for touch apps or test isolation. */
  disable?: boolean;
}

const MODIFIER_KEY_MAP: Record<string, ModifierTrigger> = {
  ' ': 'space',
  Alt: 'alt',
  Control: 'ctrl',
  Meta: 'meta',
  Shift: 'shift',
};

export function useKeybindings(
  tools: ToolsApi,
  options: UseKeybindingsOptions = {},
): void {
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (optionsRef.current.disable) return;

    function resolveSwitch(key: string): string | null {
      const o = optionsRef.current.overrides;
      if (o && key in o) return o[key]; // explicit override (may be null = unbind)
      const reg = toolsRef.current.registry;
      for (const id in reg) {
        if (reg[id].keybinding && reg[id].keybinding!.toLowerCase() === key.toLowerCase()) {
          return id;
        }
      }
      return null;
    }

    function resolveModifierEngage(key: string): string | null {
      const trigger = MODIFIER_KEY_MAP[key];
      if (!trigger) return null;
      const reg = toolsRef.current.registry;
      for (const id in reg) {
        if (reg[id].modifier === trigger) return id;
      }
      return null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      // Modifier engagement first — modifier keys (space, alt, etc.)
      // never double as switch keybindings.
      const modifierTool = resolveModifierEngage(e.key);
      if (modifierTool) {
        toolsRef.current.engageModifier(modifierTool);
        return;
      }

      const switchTo = resolveSwitch(e.key);
      if (switchTo) {
        e.preventDefault();
        toolsRef.current.setActive(switchTo);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const modifierTool = resolveModifierEngage(e.key);
      if (modifierTool && toolsRef.current.modifierEngaged === modifierTool) {
        toolsRef.current.disengageModifier();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/tools/useKeybindings.test.ts`
Expected: PASS — all five test cases.

- [ ] **Step 5: Commit**

```bash
git add src/tools/useKeybindings.ts src/tools/useKeybindings.test.ts
git commit -m "feat(tools): useKeybindings — wires tool-declared bindings to setActive/engageModifier"
```

---

## Task 6: Barrel + public exports

**Files:**
- Create: `src/tools/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create the barrel**

```ts
// src/tools/index.ts
export { defineTool } from './defineTool';
export { useTools } from './useTools';
export type { UseToolsOptions, ToolsApi } from './useTools';
export { useKeybindings } from './useKeybindings';
export type { UseKeybindingsOptions } from './useKeybindings';
export { createToolsDispatcher } from './dispatcher';
export type { ToolsDispatcher } from './dispatcher';
export type {
  Tool, ToolCtx, ToolModifiers, ToolSlot, Decision,
  ModifierTrigger,
  PointerChannel, DragChannel, KeyboardChannel, WheelChannel,
} from './types';
```

- [ ] **Step 2: Re-export from main index**

Add this line to `src/index.ts`, near the other interaction-related exports (around line 75 where `usePointerGestures` is exported):

```ts
export * from './tools';
```

- [ ] **Step 3: Verify typecheck and existing tests pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tools/index.ts src/index.ts
git commit -m "feat(tools): public barrel + re-export from src/index"
```

---

## Task 7: `<Canvas tools={tools} />` integration with passthrough fallback

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `src/canvas/Canvas.test.tsx`

When `tools` is passed to `<Canvas>`:
- The legacy `usePointerGestures(...)`-derived bindings are bypassed; instead, the canvas's pointer/wheel/keyboard events are routed through `tools.dispatcher`.
- The action-gesture hooks (`useDelete`, `useNudge`, `useUndoRedo`, `useDuplicate`) keep wiring as-is — they'll be folded into always-on tools in Phase 2.
- The cursor style on the canvas reflects the active tool's `cursor` (or the modifier-engaged tool's, if engaged).

When `tools` is omitted (the default), `<Canvas>` behaves exactly as today.

The integration is intentionally narrow in Phase 1: the dispatcher only sees pointer events. Keyboard and wheel routing through tools are wired but won't conflict with anything because no built-in tools exist yet.

The dispatcher needs a real `getCtx` to do useful work, but the substrate's contract is only "shape it correctly." `<Canvas>` synthesizes one from the existing selection / adapter / applyBatch wiring it already has.

- [ ] **Step 1: Write the failing tests**

```tsx
// Add to src/canvas/Canvas.test.tsx (append to the existing describe block at the bottom of the file)

import { useTools } from '../tools/useTools';
import { defineTool } from '../tools/defineTool';

describe('Canvas tools mode', () => {
  it('routes pointer events through tools.dispatcher when tools prop is passed', () => {
    const onDragStart = vi.fn(() => 'claim' as const);
    const onDragEnd = vi.fn(() => 'claim' as const);

    function Test() {
      const tools = useTools({
        active: 't',
        registry: {
          t: defineTool({
            id: 't',
            drag: { onStart: onDragStart, onEnd: onDragEnd },
          }),
        },
      });
      return <Canvas width={100} height={100} adapter={{} as never} tools={tools} />;
    }

    const { container } = render(<Test />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it('does NOT invoke usePointerGestures-derived selection clear when tools prop is passed', () => {
    // Tap on empty space normally calls selection.clear(); with tools wired,
    // it should route through the dispatcher instead.
    const select = { get: vi.fn(() => []), clear: vi.fn(), set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), applyClick: vi.fn() };

    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't' }) }, // no handlers — every event passes
      });
      return (
        <Canvas
          width={100}
          height={100}
          adapter={{} as never}
          selection={select as never}
          tools={tools}
        />
      );
    }

    const { container } = render(<Test />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 10, clientY: 10, pointerId: 1 });

    // Without tools, selection.clear() would have been called from the
    // usePointerGestures empty-space tap path. With tools, it must not.
    expect(select.clear).not.toHaveBeenCalled();
  });

  it('applies the active tool cursor to the canvas style', () => {
    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', cursor: 'crosshair' }) },
      });
      return <Canvas width={100} height={100} adapter={{} as never} tools={tools} />;
    }

    const { container } = render(<Test />);
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('legacy hook-prop wiring still works when tools prop is omitted', () => {
    // Smoke: existing Canvas.test.tsx cases all test the legacy path. Just
    // assert that omitting `tools` does not regress: a click clears selection.
    const select = { get: vi.fn(() => []), clear: vi.fn(), set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), applyClick: vi.fn() };

    const { container } = render(
      <Canvas width={100} height={100} adapter={{} as never} selection={select as never} />,
    );
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 10, clientY: 10, pointerId: 1 });

    expect(select.clear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/canvas/Canvas.test.tsx`
Expected: FAIL — the new "Canvas tools mode" describe block fails because `tools` is not a recognized prop.

- [ ] **Step 3: Add the `tools` prop to `CanvasProps`**

In `src/canvas/Canvas.tsx`, add to the `CanvasProps` interface (find the `gestures?: GesturesConfig<TPose>;` line — add right above or below it):

```ts
  /** Tool primitive substrate. When supplied, pointer/keyboard/wheel events
   *  are routed through `tools.dispatcher` instead of the legacy
   *  `usePointerGestures` bindings. The action-gesture hooks (delete /
   *  nudge / undoRedo / duplicate) continue to wire from `gestures` as-is
   *  in Phase 1; they'll move to always-on tools in Phase 2. */
  tools?: import('../tools/useTools').ToolsApi;
```

- [ ] **Step 4: Destructure `tools` in the component body**

Find the destructuring block near line 586 (`tool = 'none', ... gestures, ...`) and add `tools,`:

```ts
const {
  // ... existing keys
  gestures,
  tools,
  // ... rest
} = props;
```

- [ ] **Step 5: Build a `getCtx` for the dispatcher**

After `effectiveAdapter` and `effectiveSelection` are defined (around line 690), add:

```ts
// Build the per-event base ctx the tools dispatcher injects into handlers.
// Refs so identity stays stable while the underlying values update.
const effectiveSelectionRefForCtx = useRef(effectiveSelection);
effectiveSelectionRefForCtx.current = effectiveSelection;
const effectiveAdapterRefForCtx = useRef(effectiveAdapter);
effectiveAdapterRefForCtx.current = effectiveAdapter;

const toolsCtxBase = useMemo(
  () => () => ({
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: effectiveSelectionRefForCtx.current,
    adapter: effectiveAdapterRefForCtx.current,
    applyBatch: (ops: Op[], label: string) => {
      const a = effectiveAdapterRefForCtx.current as { applyBatch?: (ops: Op[], label: string) => void };
      if (a.applyBatch) a.applyBatch(ops, label);
    },
  }),
  [],
);

// If a tools prop was passed, mutate its dispatcher's ctx supplier so
// handlers see the live selection/adapter/applyBatch — useTools's own
// default ctx is the empty test stub.
useEffect(() => {
  if (!tools) return;
  // Small monkey-patch: replace the dispatcher's getCtx by re-creating it.
  // Phase 2 cleanup: thread getCtx through useTools properly so this isn't needed.
  const d = tools.dispatcher as ToolsDispatcher & { __setGetCtx?: (fn: () => unknown) => void };
  d.__setGetCtx?.(toolsCtxBase);
}, [tools, toolsCtxBase]);
```

For the dispatcher to honor a runtime `getCtx` swap, add a tiny escape hatch to `dispatcher.ts`. After the `return { ... }` in `createToolsDispatcher`, before the closing brace, expose a setter:

```ts
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
```

(Phase 2 will replace this with a proper `setCtxSupplier` method on `ToolsApi`.)

- [ ] **Step 6: Wire pointer events through the dispatcher when `tools` is set**

Find the JSX that spreads `bindings` onto the canvas (search for `{...bindings}`):

```tsx
return (
  <canvas
    ref={canvasRef}
    {...bindings}
    // ...
  />
);
```

Replace `{...bindings}` with a conditional spread:

```tsx
return (
  <canvas
    ref={canvasRef}
    {...(tools ? toolsBindings(tools) : bindings)}
    style={tools ? { ...existingStyle, cursor: resolveToolsCursor(tools) } : existingStyle}
    // ...
  />
);
```

Add helpers above the return statement:

```ts
function toolsBindings(tools: ToolsApi) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerDown(e.nativeEvent),
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerMove(e.nativeEvent),
    onPointerUp:   (e: React.PointerEvent<HTMLCanvasElement>) => tools.dispatcher.onPointerUp(e.nativeEvent),
    onWheel:       (e: React.WheelEvent<HTMLCanvasElement>) => tools.dispatcher.onWheel(e.nativeEvent),
  };
}

function resolveToolsCursor(tools: ToolsApi): string | undefined {
  const id = tools.modifierEngaged ?? tools.active;
  const tool = tools.registry[id];
  if (!tool?.cursor) return undefined;
  if (typeof tool.cursor === 'string') return tool.cursor;
  // Function form requires a ctx; defer to Phase 2.
  return undefined;
}
```

`existingStyle` should be whatever the current canvas style spread looks like in your code — adapt to match.

- [ ] **Step 7: Wire keyboard routing through the dispatcher**

Add an effect that subscribes document keydown/keyup to the dispatcher when `tools` is set:

```ts
useEffect(() => {
  if (!tools) return;
  const onDown = (e: KeyboardEvent) => tools.dispatcher.onKeyDown(e);
  const onUp = (e: KeyboardEvent) => tools.dispatcher.onKeyUp(e);
  document.addEventListener('keydown', onDown);
  document.addEventListener('keyup', onUp);
  return () => {
    document.removeEventListener('keydown', onDown);
    document.removeEventListener('keyup', onUp);
  };
}, [tools]);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm vitest run src/canvas/Canvas.test.tsx`
Expected: PASS — both new tests, plus all existing Canvas tests.

If existing tests fail, revisit the conditional `{...(tools ? toolsBindings(tools) : bindings)}` — the legacy bindings must still spread when `tools` is omitted.

- [ ] **Step 9: Run the full test suite + typecheck + lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS — 793+ tests pass (existing) plus new tools/Canvas tests.

- [ ] **Step 10: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx src/tools/dispatcher.ts
git commit -m "feat(canvas): tools prop — route pointer/keyboard/wheel through tools.dispatcher"
```

---

## Task 8: End-to-end smoke (defineTool → useTools → useKeybindings → Canvas)

**Files:**
- Create: `src/tools/integration.test.tsx`

A single integration test that exercises every Phase 1 module together. Catches wiring regressions that pass each unit test in isolation.

- [ ] **Step 1: Write the test**

```tsx
// src/tools/integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Canvas } from '../canvas/Canvas';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './defineTool';

describe('Phase 1 integration: define → use → key → canvas', () => {
  it('keybinding switches active tool, drag routes through new tool', () => {
    const selectDrag = vi.fn(() => 'claim' as const);
    const penDrag    = vi.fn(() => 'claim' as const);

    function App() {
      const tools = useTools({
        active: 'select',
        registry: {
          select: defineTool({ id: 'select', keybinding: 'v', drag: { onStart: selectDrag } }),
          pen:    defineTool({ id: 'pen',    keybinding: 'p', drag: { onStart: penDrag } }),
        },
      });
      useKeybindings(tools);
      return <Canvas width={100} height={100} adapter={{} as never} tools={tools} />;
    }

    const { container } = render(<App />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // 1. Drag with select active.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(selectDrag).toHaveBeenCalledOnce();
    expect(penDrag).not.toHaveBeenCalled();

    // 2. Press 'p' to switch.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });

    // 3. Drag with pen active.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(penDrag).toHaveBeenCalledOnce();
    expect(selectDrag).toHaveBeenCalledOnce(); // not called again
  });

  it('modifier-slot tool engages while space is held', () => {
    const handDrag = vi.fn(() => 'claim' as const);
    const selectDrag = vi.fn(() => 'claim' as const);

    function App() {
      const tools = useTools({
        active: 'select',
        registry: {
          select: defineTool({ id: 'select', drag: { onStart: selectDrag } }),
          hand:   defineTool({ id: 'hand', modifier: 'space', drag: { onStart: handDrag } }),
        },
      });
      useKeybindings(tools);
      return <Canvas width={100} height={100} adapter={{} as never} tools={tools} />;
    }

    const { container } = render(<App />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // Engage space.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });

    // Drag — should hit hand, not select.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(handDrag).toHaveBeenCalledOnce();
    expect(selectDrag).not.toHaveBeenCalled();

    // Release space.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    });

    // Drag — back to select.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(selectDrag).toHaveBeenCalledOnce();
    expect(handDrag).toHaveBeenCalledOnce(); // not called again
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `pnpm vitest run src/tools/integration.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 3: Run the full suite one more time**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tools/integration.test.tsx
git commit -m "test(tools): Phase 1 integration smoke — keybinding switch + modifier engagement"
```

---

## Self-Review Notes

- **Spec coverage**: All Phase 1 deliverables from the spec map to a task — types (1), defineTool (2), dispatcher with channels & slots & threshold (3), useTools with active+modifier+gesture-cancel (4), useKeybindings with overrides+disable+modifier engagement (5), public exports (6), Canvas integration with passthrough fallback (7), end-to-end integration (8).
- **Cursor handling**: Phase 1 spec says cursor goes on the tool with palette-level override. The override map is explicitly Phase 2 in the spec; the per-tool string cursor is wired in Task 7 step 6.
- **Function-form cursors**: Deferred — noted in `resolveToolsCursor`, requires ctx.
- **`__setGetCtx` escape hatch**: Acknowledged as a Phase 2 cleanup target. The alternative (threading `getCtx` through `useTools` props) couples `useTools` to canvas internals more tightly than warranted for Phase 1 substrate.
- **No built-in tools, no demo migration** — intentionally Phase 2/3.

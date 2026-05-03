# Interaction channels — substrate for the Tools primitive

Status: draft / pre-design. Tested against two tools (`select`, hypothetical
`pen`) per the test in `canvas-surface-map.md` ("draft the channel
interface against two concrete tools and see whether the abstraction holds
without strain").

This proposal does **not** redesign the public Canvas surface. It proposes
the *internal* substrate that a future `tools={...}` prop would sit on
top of. Public-surface changes follow once this shape is validated.

## Why a substrate first

Today every gesture hook (`useMove`, `useResize`, `useRotate`,
`useAreaSelect`, `useEditAnchors`, `useDelete`, `useNudge`, `useClipboard`,
…) reaches independently into pointer events, drag-threshold logic,
keyboard binding, and selection. The kit has helpers for all of these
(`usePointerGestures`, `useKeybinding`, `thresholdDrag`, etc.) but no
unifying contract — each hook decides its own shape. That works for a
fixed set of hooks; it doesn't generalize to "a consumer ships a new
tool."

The substrate gives every tool the same set of input streams ("channels")
and a uniform way to claim/decline events. A `Tool` is then a record of
`{ pointer?, drag?, keyboard?, wheel? }` handlers — small, inspectable,
composable.

## The channels

Four interaction channels. The kit owns dispatch on each; tools register
handlers.

### 1. Pointer

Discrete pointer events without drag promotion: `hover`, `down`, `up`,
`tap` (down→up under a movement threshold), `dblTap`. Carries world
coords, modifier state, and a kit-resolved hit (`hitId`, `hitKind`:
`'body' | 'handle' | 'rotationHandle' | 'empty'`).

```ts
interface PointerEvent {
  phase: 'hover' | 'down' | 'up' | 'tap' | 'dblTap';
  world: { x: number; y: number };
  client: { x: number; y: number };
  modifiers: { shift: boolean; meta: boolean; alt: boolean; ctrl: boolean };
  hit: { id: string | null; kind: 'body' | 'handle' | 'rotationHandle' | 'empty' };
  buttons: number;
}
```

### 2. Drag

Threshold-promoted drag, separate channel because the gesture state machine
(start/move/end/cancel) is different. The kit promotes a pointer-down to a
drag once movement crosses the threshold; the tool's `drag.start` decides
whether to claim the gesture.

```ts
interface DragStartEvent extends PointerEvent {
  phase: 'start';
  startWorld: { x: number; y: number };
}
interface DragMoveEvent {
  phase: 'move';
  world: { x: number; y: number };
  delta: { dx: number; dy: number };  // since start
  modifiers: PointerEvent['modifiers'];
}
interface DragEndEvent {
  phase: 'end' | 'cancel';
  world: { x: number; y: number };
  modifiers: PointerEvent['modifiers'];
}
```

Drag handlers return a `DragSession` object the kit drives until end:

```ts
interface DragSession {
  onMove(e: DragMoveEvent): void;
  onEnd(e: DragEndEvent): void;
}
```

This is where `useMove`/`useResize`/`useRotate`'s overlay state lives —
each becomes a `DragSession` factory.

### 3. Keyboard

Already factored as `useKeybinding` underneath. Channel surface:

```ts
interface KeyEvent {
  key: string;          // e.g. 'ArrowLeft', 'Delete', 'g'
  modifiers: PointerEvent['modifiers'];
  phase: 'down' | 'up' | 'press';
  // Whether the canvas has focus / consumer's text input is active, etc.
  // Tools can ignore events that don't apply to them.
  context: { canvasFocused: boolean; editingText: boolean };
}
```

### 4. Wheel

Standalone because zoom/pan tools want it without touching pointer.

```ts
interface WheelEvent {
  world: { x: number; y: number };
  deltaX: number;
  deltaY: number;
  modifiers: PointerEvent['modifiers'];
}
```

## Tool shape

```ts
interface Tool {
  id: string;
  cursor?: (state: ToolState) => string;  // CSS cursor based on hover/hit/etc.
  pointer?: (e: PointerEvent, ctx: ToolCtx) => Decision;
  drag?: {
    start(e: DragStartEvent, ctx: ToolCtx): DragSession | Decision;
  };
  keyboard?: (e: KeyEvent, ctx: ToolCtx) => Decision;
  wheel?: (e: WheelEvent, ctx: ToolCtx) => Decision;
  /** Lifecycle for tools that hold modal state (in-progress pen path,
   *  active text edit). */
  onActivate?(ctx: ToolCtx): void;
  onDeactivate?(ctx: ToolCtx): void;
}

type Decision = 'claim' | 'pass';

interface ToolCtx {
  selection: SelectionApi;
  scene: SceneReadAdapter;        // read-only view
  ops: OpDispatcher;              // record/apply/batch
  helpers: CanvasHelpers<unknown>;
  // ...the same helpers tool authors have today, just bundled.
}
```

`Decision` is the dispatch contract — `'claim'` stops propagation to
lower-priority tools; `'pass'` lets them try. Drag's `start` returns
either a `DragSession` (claim + drive) or `'pass'`.

## Dispatch model

Three slots: **active tool**, **modifier tool** (transient — space-to-pan,
alt-to-eyedrop), **always-on tools** (selection-scoped keyboard:
delete/nudge/duplicate/undo/redo).

For each event, the kit dispatches in this order until one claims:

1. **Modifier tool** if a modifier-tool key is held.
2. **Active tool**.
3. **Always-on tools** in registered order.

This makes today's flat `gestures.{delete, nudge, duplicate, undoRedo}`
config a list of always-on tools that only register a `keyboard` handler.

## Example — `select` tool

The current `tool='select'` plus the always-on selection gestures, expressed
as one tool:

```ts
const selectTool: Tool = {
  id: 'select',
  cursor: (state) => state.hoverHit?.kind === 'handle' ? 'nwse-resize' : 'default',
  pointer: (e, ctx) => {
    if (e.phase !== 'tap') return 'pass';
    if (e.hit.kind === 'empty') {
      if (!e.modifiers.shift) ctx.selection.clear();
      return 'claim';
    }
    if (e.hit.id) {
      e.modifiers.shift ? ctx.selection.toggle(e.hit.id) : ctx.selection.set([e.hit.id]);
      return 'claim';
    }
    return 'pass';
  },
  drag: {
    start: (e, ctx) => {
      if (e.hit.kind === 'body' && e.hit.id) {
        return moveSession(ctx, e.hit.id);  // factory; returns DragSession
      }
      if (e.hit.kind === 'handle') return resizeSession(ctx);
      if (e.hit.kind === 'rotationHandle') return rotateSession(ctx);
      if (e.hit.kind === 'empty') return marqueeSession(ctx);
      return 'pass';
    },
  },
  keyboard: (e, ctx) => {
    // The always-on actions are separate tools; select itself only handles Esc.
    if (e.key === 'Escape' && e.phase === 'down') {
      ctx.selection.clear();
      return 'claim';
    }
    return 'pass';
  },
};
```

`moveSession` / `resizeSession` / `rotateSession` / `marqueeSession` are
the existing controllers, refactored to fit the `DragSession` shape. The
hit-kind switch in `drag.start` is exactly the dispatch the current
Canvas does inline today.

## Example — hypothetical `pen` tool

A modal tool that builds a multi-anchor path; demonstrates *why*
`onActivate`/`onDeactivate` are on the interface and why pointer + drag
both matter for one tool.

```ts
function makePenTool(insert: (path: Path) => void): Tool {
  // Tool-local state — survives across events while active, discarded on deactivate.
  let anchors: { x: number; y: number; tangent?: { x: number; y: number } }[] = [];
  let pendingTangent: DragSession | null = null;

  const finalize = (close: boolean) => {
    if (anchors.length >= 2) insert(buildPathFromAnchors(anchors, close));
    anchors = [];
  };

  return {
    id: 'pen',
    cursor: () => 'crosshair',
    pointer: (e) => {
      if (e.phase === 'tap') {
        // Click without drag = corner anchor (no tangent).
        anchors.push({ x: e.world.x, y: e.world.y });
        return 'claim';
      }
      return 'pass';
    },
    drag: {
      start: (e) => {
        // Press-and-drag = anchor with outgoing tangent.
        const anchor: typeof anchors[number] = { x: e.startWorld.x, y: e.startWorld.y };
        anchors.push(anchor);
        return {
          onMove: (m) => { anchor.tangent = { x: m.delta.dx, y: m.delta.dy }; },
          onEnd: () => {},
        };
      },
    },
    keyboard: (e) => {
      if (e.phase !== 'down') return 'pass';
      if (e.key === 'Escape') { finalize(false); return 'claim'; }
      if (e.key === 'Enter')  { finalize(true);  return 'claim'; }
      return 'pass';
    },
    onDeactivate: () => { finalize(false); pendingTangent = null; },
  };
}
```

What this exercises in the substrate:

- **Tool-local state** (`anchors`) lives in the tool closure, not in the
  kit. The kit only invokes lifecycle hooks; it doesn't know what a
  half-built path is.
- **Pointer + drag from one input gesture.** The kit decides which
  channel based on movement threshold; the tool gets either a tap or a
  drag, never both, never the wrong one.
- **Modal escape.** Esc/Enter as keyboard channel claims; deactivate
  cleans up.
- **No interaction with selection.** Pen doesn't need the selection
  channel at all — its `Tool` simply doesn't register selection-related
  handlers. That's how we know `selection` is a tool concern, not a
  channel concern.

## What this surfaces

**The abstraction holds** for these two tools without strain. Each tool
expresses everything it cares about; nothing leaks across.

**Open questions (not blockers, but worth noting):**

1. **Cursor as a function vs imperative `setCursor`.** The function
   approach is declarative but requires the kit to track `ToolState` (hover
   hit, drag in progress) — that's already most of what the kit tracks.
   Probably fine.
2. **Always-on vs active tools and channel ordering.** When the active
   tool is `pen`, do `Delete` / arrow nudges still apply to selection?
   Probably yes — the always-on tools register against keyboard only and
   pen's keyboard handler returns `'pass'` for keys it doesn't care
   about. Dispatch order naturally handles this.
3. **Mid-drag tool switch.** If the user hits the `v` shortcut while
   drag-painting a pen segment, what happens? Likely: kit cancels the
   active drag (sends `phase: 'cancel'` to the session), then activates
   the new tool. Worth specifying.
4. **Drag controllers are factories of `DragSession`s, not tools
   themselves.** `useMove` etc. become "given ctx + target id, return a
   `DragSession`." The current `move` / `resize` / `rotate` Canvas
   controller props become composable units the select tool calls into.
   Tools own *which* controller fires on *which* hit kind; controllers
   own the session itself. This split is good — it means custom tools
   can reuse the kit's move/resize logic without inheriting select's
   dispatch decisions.
5. **`onTapEmpty` / `onBodyHit` from today's surface** become return
   values from the active tool's `pointer` handler. Removed from the
   public Canvas prop surface eventually.

## Next step

If this looks right, the implementation order is:

1. Land `PointerEvent` / `DragSession` / `KeyEvent` / `WheelEvent`
   types as internal contracts. No public-surface changes yet.
2. Refactor *one* gesture (probably `useMove`) into a `DragSession`
   factory. Keep `useMove` as a public alias that wraps it.
3. Refactor the Canvas's inline pointer dispatch into the channel-based
   dispatcher.
4. Reimplement today's `tool='select'` as the built-in `selectTool`
   above; verify all demos still work.
5. *Then* design the public `tools` / `activeTool` API on top.

Steps 1–4 are pure internal refactor. Step 5 is the user-visible
surface change and depends on the `canvas-surface-map.md` direction.

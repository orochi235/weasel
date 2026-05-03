# Tool Primitive Design

**Date:** 2026-05-03
**Status:** Approved (brainstorm); plan pending

## Summary

`weasel` currently exposes interaction as a soup of hooks (`useMove`, `useResize`, `useRotate`, `useInsert`, `useAreaSelect`, `useEditAnchors`) wired together inside `<Canvas>`. Building a new "mode" — a pen tool, a hand tool, a text tool — means either composing existing hooks ad-hoc or forking `<Canvas>`. There's no shared substrate for "the user's currently active tool," no way to install hold-to-pan-style modifier tools, and no first-class place to declare keybindings or cursors.

This spec defines a **Tool primitive**: a record describing how a single tool listens to interaction channels (pointer / drag / keyboard / wheel), plus a **palette** that holds the active tool, the modifier-engaged tool, and any always-on tools, and a `<Canvas palette={palette} />` integration point.

The primitive replaces the existing gesture hooks in a phased migration: built-in tools (`select`, `hand`, `insert`) wrap the current implementations behind the new surface; once all demos are on the palette, the legacy hooks are deleted.

The forcing demo is "Swillustrator" — a five-tool palette (select, pen, insert-rect, hand, text) that exercises every slot, every channel, and the tool-internal vs tool-switch modifier distinction.

## Goals

- One way to define an interactive "mode": `defineTool({ id, channels, ... })`.
- Tool authors don't reinvent gesture lifecycle, threshold-gated drag, or pointer capture.
- Tools declare their own keybindings and modifier triggers; consumers can override per-app.
- Hold-to-engage modifier tools (space-pan, alt-eyedropper) work out of the box.
- Always-on actions (delete, nudge, undo/redo) are tools too.

## Non-goals

- Shipping a complete tool catalogue. The kit ships only domain-agnostic generics; pen / text / insert-rect live as cookbook demos.
- Replacing the underlying op / history / scene model. Tools dispatch ops via `ctx.applyBatch(ops, label)` — same path the existing hooks use.
- Cross-tool composition primitives (chained tools, tool macros). YAGNI until a real use case lands.

## Architecture

### Slots

The palette has three slots. A single tool can be installed into any slot, depending on how the consumer wires it.

- **Active slot** — the user's currently selected tool. Exactly one. Switched by clicking a palette button or pressing the tool's keybinding. Persists until another tool is activated.
- **Modifier slot** — a tool engaged temporarily *while a modifier key is held*. Hand-while-space, eyedropper-while-alt. Auto-deactivates on key-up. Zero or one at a time.
- **Always-on slot** — tools with no notion of "active" because they only respond to discrete triggers (Backspace, arrow keys, Cmd-Z). Listen continuously, regardless of the active tool.

### Dispatch order

Every interaction event walks `modifier → active → always-on`. The first handler to return `'claim'` wins; subsequent slots don't see the event. Order is uniform across all four channels.

### Channels

Four channels carry events into tools.

- **`pointer`** — `onDown` (raw, pre-threshold; escape hatch), `onClick` (sub-threshold release).
- **`drag`** — `onStart` (threshold exceeded), `onMove`, `onEnd`, `onCancel`. Framework-owned threshold disambiguation: a tool sees either `pointer.onClick` or `drag.*` for a given gesture, never both.
- **`keyboard`** — `onDown`, `onUp`. Modifier key state is also surfaced on `ctx.modifiers` for any handler.
- **`wheel`** — `onWheel`. Cheap to include; future-proofs zoom-on-wheel hand tools.

### Modifier semantics

Two distinct roles for modifier keys:

- **Tool-internal modifiers** (shift constrains marquee to square; alt resizes from center; shift snaps pen to angle): always available as flags via `ctx.modifiers.shift / .alt / .ctrl / .meta`. The active tool reads them and changes behavior. Never trigger a tool switch.
- **Modifier-slot triggers** (space → hand): only engage when **no gesture is active**. Mid-gesture, the modifier-slot key is ignored as a trigger; if the active tool wants to read it, it can, but the modifier-slot tool stays dormant.

Once a gesture starts, modifiers from that point on are flags only. This matches Photoshop/Illustrator behavior and keeps drags un-interruptible by stray key presses.

### Gesture interruption

- **Modifier-slot trigger**: only engages on idle. No interruption mid-gesture.
- **Explicit switch** (palette click or keybinding): preempts and cancels the active gesture. Current tool gets `drag.onCancel`, scratch is discarded, new tool takes over. Treated as a UX bug if it happens regularly.

### Tool record

```ts
interface Tool<TScratch = unknown> {
  id: string;
  keybinding?: string;            // 'v', 'p', 'shift+r'
  modifier?: 'space' | 'alt' | 'ctrl' | 'meta' | 'shift';

  initScratch?: () => TScratch;
  onActivate?: (ctx: ToolCtx) => void;
  onDeactivate?: (ctx: ToolCtx) => void;

  pointer?: {
    onDown?:  (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
    onClick?: (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
  };
  drag?: {
    onStart?:  (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
    onMove?:   (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
    onEnd?:    (e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision;
    onCancel?: (ctx: ToolCtx<TScratch>) => void;
  };
  keyboard?: {
    onDown?: (e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision;
    onUp?:   (e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision;
  };
  wheel?: {
    onWheel?: (e: WheelEvent, ctx: ToolCtx<TScratch>) => Decision;
  };

  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
}

type Decision = 'claim' | 'pass';
```

### ToolCtx

Shared per-event context.

```ts
interface ToolCtx<TScratch = unknown> {
  worldX: number;
  worldY: number;
  modifiers: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean; space: boolean };
  selection: SelectionApi;
  scene: Scene<...> | null;
  adapter: AnyAdapter;
  applyBatch: (ops: Op[], label: string) => void;
  scratch: TScratch;   // typed via Tool<TScratch>; persists across a single gesture, reset on gesture end
}
```

### Public API

```ts
const select = defineTool({ id: 'select', keybinding: 'v', ... });
const pen    = defineTool({ id: 'pen',    keybinding: 'p', ... });
const hand   = defineTool({ id: 'hand',   keybinding: 'h', modifier: 'space', ... });
const del    = defineTool({ id: 'delete', keybinding: 'Backspace', ... }); // always-on

const palette = useToolPalette({
  active: 'select',
  tools: { select, pen, hand },
  alwaysOn: [del, nudge, undoRedo],
});

useKeybindings(palette);                                 // wires declared bindings
useKeybindings(palette, { overrides: { v: 'pen' } });    // remap
useKeybindings(palette, { disable: true });              // touch app, no keyboard

return <Canvas palette={palette} ... />;
```

The palette infers slot routing from each tool's record: tools with `modifier` go to the modifier slot, tools in `alwaysOn` go to the always-on slot, the rest are eligible for the active slot.

### Cursor handling

`cursor` declared on the tool. Palette-level override:

```ts
useToolPalette({ ..., cursorOverride: { hand: 'grabbing' } });
```

`<Canvas>` reads the active tool's cursor (or the modifier-engaged tool's, when in modifier mode) and applies it to the canvas element.

### Built-in tool catalogue

Kit ships **only generic, domain-agnostic** tools:

- `select` — wraps current useMove + useResize + useRotate + useAreaSelect.
- `hand` — pan via canvas viewport (depends on viewport spec, separate doc).
- `insert` — generic drag-rectangle factory; consumer supplies `commitInsert`.
- `eyedropper-stub` — minimal sample for modifier-slot pattern; users supply the actual color-picking logic via `onClick` handler.
- Always-on: `deleteSelection`, `nudge`, `undoRedo`, `duplicate` (existing `useDelete`/`useNudge`/`useUndoRedo`/`useDuplicate` hooks repackaged as Tool records).

Pen, text, insert-rect, and any domain-specific tool live in `demo/` as reference implementations. They're how userland learns to build a tool, not part of the public surface.

## Migration plan

Phased — kit ships old hooks alongside the new primitive until parity is reached.

### Phase 1: foundation

- Add `defineTool`, `useToolPalette`, `useKeybindings`, `Tool` / `ToolCtx` / `Decision` types.
- Add `<Canvas palette={palette} />` prop. When present, palette dispatch replaces the current gesture wiring; when absent, `<Canvas>` falls back to existing hook-based behavior.
- No tools shipped yet. Pure substrate.

### Phase 2: built-in tools

- Implement kit-shipped tools as Tool records that wrap the existing hooks: `select`, `hand`, `insert`, always-on action tools.
- Add Swillustrator demo: select + pen + insert-rect + hand + text from the demo cookbook.
- Existing demos keep using the legacy hook props.

### Phase 3: demo migration

- Port every demo from hook-props (`gestures={...}`, `tool="select"`) to `palette={...}`.
- Each port either uses the kit-shipped built-in tools or copies a cookbook demo tool.

### Phase 4: legacy removal

- Once no demo uses the old surface, delete `useMove` / `useResize` / `useRotate` / `useInsert` / `useAreaSelect` / `useEditAnchors` from the public API. They survive as internal implementation details of the built-in tools.
- Remove the `<Canvas>` legacy gesture props.

Per [feedback memory](../../.claude/projects/-Users-mike-src-weasel/memory/breaking_changes_ok.md): no compatibility shims between phases beyond what's needed during the rollout. Each phase commits cleanly; the old surface goes away in 4.

## Open questions

- Does `useToolPalette` need to expose the live "modifier currently engaged?" boolean for UI affordances (palette button highlight)? Probably yes — defer until UI work.
- Does `Decision` need a third value `'claim-and-stop-modifiers'` or similar for tools that want to suppress modifier-key flag updates while active? No real use case yet; punt.
- Touch / pen-stylus pressure: out of scope. Wheel channel is the only non-pointer-non-keyboard channel for now.

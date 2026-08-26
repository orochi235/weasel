# Eyedropper tool

**Goal:** Ship a kit-native `useEyedropperTool` that lets the user sample a color from a scene node — engaged either as a sticky palette tool (`I` keybinding, like Photoshop / Figma) or as a momentary hotkey-slot tool while `Alt` is held — and forward the sampled color to a consumer-supplied callback.

**Tech Stack:** TypeScript, React, weasel kit declarative `defineTool` routing, Vitest + React Testing Library.

**Status:** design

**Source:** Two prior planning hooks call this out:

- `docs/specs/2026-05-03-tool-primitive-design.md` — modifier (hotkey) slot pattern, with eyedropper as the canonical "hold-alt to engage" example.
- `2026-05-03-tool-primitive-phase-2a` (plan, deleted at merge) (line 1400) — Phase 2a deferral that left `eyedropper-stub` as the minimal sample tool not yet implemented.

---

## Overview

An eyedropper does one thing: tell the consumer "the color at the point you clicked." Where that color goes is a userland concern (active fill swatch, active stroke swatch, fill input on a property panel, etc.) — not a kit concern.

The kit ships a declarative tool that:

1. Accepts an `onPick(color: string | null)` callback from the consumer.
2. Accepts a `colorOf(id: string) => string | null` accessor that maps a scene node id to a color string. The tool is shape-agnostic — it never inspects `node.data.fill` directly; the consumer's accessor is the only contact point with the scene's color model.
3. Routes `pointer.click` over any node-kind through `pickFromNode`, which calls `colorOf(ctx.target.id)` and forwards the result to `onPick`.
4. Routes `pointer.click` on empty space through a no-op (no `onPick` call). Click-to-clear is out of scope for v1.
5. Exposes `keybinding: { key: 'I' }` and `hotkey: 'alt'` so it works both as an active-slot palette tool and a hotkey-slot modifier tool out of the box.

Engagement (active slot vs hotkey slot) is handled by the existing tools registry — eyedropper itself just declares both surfaces.

## Why the kit wants this

- It's the smallest non-trivial example of the hotkey-slot pattern. Hand uses `space`, eyedropper uses `alt`; together they exercise both common modifier-trigger keys.
- It's the smallest tool that emits a side effect without writing to the scene. Every other built-in tool either mutates the viewport (`hand`, `wheelZoom`) or applies ops (`select`, `rect`, `pen`). Eyedropper is the canonical "tell me what's there" tool, and it forces the kit's design to admit pure-read tools as a first-class shape.
- The Swillustrator demo already has fill + stroke swatches that beg to be alt-clickable. Mike has been wanting this; the kit having no eyedropper is currently a visible gap.

## API surface

```ts
export interface UseEyedropperToolOptions {
  /** Called when the user picks a color. `null` means "no node was hit"
   *  (currently unreachable in v1 because empty-click is a no-op, but
   *  the signature reserves the slot for a future "click empty to clear"
   *  opt-in). */
  onPick: (color: string | null) => void;

  /** Map a scene node id to a color string, or `null` if the node has no
   *  meaningful color to sample (e.g. a transparent group). Called with
   *  `ctx.target.id` from the click route. Consumer-owned — the kit
   *  never inspects `node.data` directly. */
  colorOf: (id: string) => string | null;

  /** Override the default `I` keybinding. Pass `null` to omit. */
  keybinding?: KeyBinding | null;

  /** Override the default `'alt'` hotkey trigger. Pass `null` to omit
   *  (e.g. an app that wants the eyedropper to be palette-only and
   *  doesn't want alt to engage it). */
  hotkey?: HotkeyTrigger | null;
}

export function useEyedropperTool(opts: UseEyedropperToolOptions): Tool<null>;
```

The hook returns a `Tool<null>` (no scratch — there's no in-flight gesture state to track for v1's click-only model). The tool is registered via the standard `useTools` registry; consumers wire it into `registry` (active slot) and/or rely on its declared `hotkey: 'alt'` to make it engage on alt-hold.

## Behavior model

### Engagement

The eyedropper is **dual-slotted**: it declares both `keybinding: { key: 'I' }` (active slot) and `hotkey: 'alt'` (hotkey slot). Three things happen depending on how the consumer wires it:

| Wiring                                                | Behavior                                                                                                          |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| In `registry` only                                    | `I` switches the active tool to eyedropper; alt-hold engages it momentarily on top of the active tool.            |
| In `registry`, `hotkey: null` override                | `I` switches; alt-hold does nothing. For apps that already use alt for clone/duplicate (e.g. `useCloneTool`).     |
| In `registry`, with `useCloneTool` in `ambient`       | Both wired. Alt-drag still routes to clone (drag claims first); alt-click without drag routes to eyedropper.      |

The conflict with `useCloneTool` in (3) is *not* a problem in practice because clone claims at `drag.onStart` (post-threshold), while eyedropper claims at `pointer.click` (sub-threshold release). Alt-drag → clone; alt-click → eyedropper. The two surfaces don't overlap.

### Pick gesture

v1 is **click-only**:

- Sub-threshold release over a scene node → `onPick(colorOf(id))`. If `colorOf` returns `null`, `onPick(null)` fires (consumer chooses whether to no-op or treat that as "clear").
- Sub-threshold release over empty space → no-op (no `onPick` call). The route exists (so the dispatcher's "any click on the empty kind" doesn't fall through to a stale background) but returns `none()`.
- Drag is not bound. A drag that starts but never crosses the threshold ends as a click; a real drag (past threshold) emits no eyedropper event.

Continuous drag-to-sample with a live color preview is a follow-up — the v1 surface intentionally doesn't reserve `drag.onStart`, so a follow-up can add it without a breaking change.

### Cursor

`cursor: 'crosshair'`. A rich cursor with a small swatch-preview chip is a follow-up — out of scope for v1.

## Integration with declarative routing

The tool is built via `defineTool<null>` from `src/tools/routing`. The click route table is the entire behavior surface:

```ts
import { defineTool, claim, none } from '../routing';
import type { ActionFn } from '../routing';

const pickFromNode: ActionFn<null> = (ctx) => {
  if (ctx.target?.category !== 'node') return none();
  const color = colorOfRef.current(ctx.target.id);
  onPickRef.current(color);
  return claim();
};

const onEmptyClick: ActionFn<null> = () => none();

return defineTool<null>({
  id: 'eyedropper',
  keybinding: keybinding ?? { key: 'I' },
  hotkey: hotkey ?? 'alt',
  cursor: 'crosshair',
  presentation: {
    label: 'Eyedropper',
    icon: createElement(EyedropperIcon),
    group: 'view',
  },
  initial: {
    click: {
      rect:  pickFromNode,
      text:  pickFromNode,
      path:  pickFromNode,
      '*':   pickFromNode,
      empty: onEmptyClick,
    },
  },
});
```

Refs (`colorOfRef`, `onPickRef`) hold the latest callbacks so the memoized tool body doesn't rebuild on every consumer re-render — same pattern as `useRectTool`'s `createRef` and `useSelectTool`'s `onDoubleTapRef`.

`keybinding: null` / `hotkey: null` overrides are honored by `?? defaultValue` defaults and by passing `undefined` (not `null`) into `defineTool` when the consumer opts out.

The icon (`EyedropperIcon`) is a new asset in `src/icons/` — a small dropper outline — added alongside this tool.

## Design decisions

These five questions were the gate; locked-in answers:

### 1. What does the eyedropper sample? → Scene node color (option A)

The kit-native shape is the consumer-supplied `colorOf(id) => string | null` accessor. Universal because every scene that wires the eyedropper provides its own accessor — there is no kit-defined "fill" field, so reading from the scene structurally would force a coupling the kit doesn't have anywhere else.

Pixel-mode sampling (reading `getImageData` from the canvas) is **not built in**. A consumer who needs it can wire a `colorOf` that reads pixels via a tool-side reference to the canvas element. This is documented as a follow-up.

### 2. What does it write to? → Consumer callback (option A)

The tool calls `onPick(color)`. Where the color goes is the consumer's choice — active fill swatch, active stroke swatch, an input on a property panel, a clipboard. Writing an op (`createSetFillOp`) would require the kit to define a fill field on every node, which violates the kit's pose / data separation.

### 3. Engagement model → Both slots, declared by the tool

The tool declares `keybinding: { key: 'I' }` AND `hotkey: 'alt'`. Consumers can override either to `null` if they want one shape only. Default is: palette-selectable (active) **and** momentary on alt — matches Photoshop, Sketch, Figma.

### 4. Cursor → `'crosshair'`

v1 ships `cursor: 'crosshair'`. A rich cursor with a small swatch preview chip is a follow-up.

### 5. What gesture fires the pick? → Click

`pointer.click` only. Drag is unbound in v1. Continuous drag-to-sample with live preview is a follow-up.

## Consumer wiring (Swillustrator)

```tsx
const eyedropper = useEyedropperTool({
  colorOf: (id) => {
    const obj = itemsRef.current.find((o) => o.id === id);
    if (!obj) return null;
    // For Swillustrator: prefer fill, fall back to stroke. The eyedropper
    // samples whichever swatch is "more visible" on the shape.
    if (obj.kind === 'rect' || obj.kind === 'path') return obj.fill || obj.stroke || null;
    if (obj.kind === 'text') {
      const f = obj.style?.fill;
      return f?.fill === 'solid' ? f.color : null;
    }
    return null;
  },
  onPick: (color) => {
    if (color == null) return;
    // Picked color writes to whichever swatch is currently focused.
    if (focusedSwatchRef.current === 'fill') {
      setActiveFill({ kind: 'solid', color });
    } else {
      setActiveStroke({ kind: 'solid', color });
    }
  },
});

const tools = useTools({
  active: 'select',
  registry: { select, /* ..., */ eyedropper },
  ambient: [wheelZoom, wheelPan, keyZoom, clone],
});
```

Wired this way: pressing `I` switches to the eyedropper as the active tool. Holding `alt` while any other tool is active engages eyedropper momentarily; releasing `alt` restores the prior tool. Alt-drag still routes to `clone` (the clone tool's drag claim fires before eyedropper's click claim).

## Tests (sketch — full list in the plan)

- `keybinding === { key: 'I' }`, `hotkey === 'alt'`, `cursor === 'crosshair'`.
- Click on a node (target.category === 'node', kind === 'rect') with `colorOf` returning `'#ff0000'` → `onPick` called once with `'#ff0000'`.
- Click on a node with `colorOf` returning `null` → `onPick` called once with `null`.
- Click on empty → `onPick` not called at all.
- A `drag.onStart` call (past threshold) → no `onPick`. (The route table has no `drag` entry, so the dispatcher's drag pipeline finds nothing to claim.)
- `hotkey: null` override → returned Tool's `hotkey === undefined`.
- `keybinding: null` override → returned Tool's `keybinding === undefined`.
- Latest-callback ref behavior: re-render with a different `onPick`, then click — the *new* callback receives the call.

## Out of scope / follow-ups

These are deliberately deferred. Each is a small, well-scoped follow-up the v1 surface admits without breaking change:

- **Pixel-mode sampling.** A `useEyedropperTool` variant (or an option) that reads `getImageData` from the canvas backing store, for sampling layers the consumer can't address structurally (e.g. raster image layers, post-processing overlays). The v1 surface doesn't preclude this — a consumer can wire a custom `colorOf` that reads pixels today by capturing the canvas element via a tool ref. A first-party version is a follow-up if multiple consumers ask.
- **Continuous drag-to-sample with live preview.** Add `drag.onStart` / `drag.onMove` / `drag.onEnd` routes that call a new `onPreview(color | null)` while dragging and commit (or revert) on release. v1 leaves the drag channel unbound, so this is additive.
- **Rich cursor with swatch chip.** A function-form `cursor: (ctx) => string` that returns a data-URL SVG cursor with the most-recently-previewed color baked in. Requires drag-preview first.
- **Eyedropper-from-image-layer.** Specialization of pixel mode: sample only from image layers, ignoring vector overlays. Useful for tracing tools.
- **Click-empty-to-clear semantic.** Opt-in flag to make empty-click call `onPick(null)`. Currently the route returns `none()`; flipping it to a single-line conditional is trivial.
- **Touch / stylus pressure.** No special handling needed — eyedropper is click-only, and the dispatcher treats touch the same as pointer.

## Files touched

- New: `src/tools/builtin/useEyedropperTool.ts`
- New: `src/tools/builtin/useEyedropperTool.test.ts`
- New: `src/icons/EyedropperIcon.tsx`
- Modify: `src/icons/index.ts` — export `EyedropperIcon`.
- Modify: `src/tools/builtin/index.ts` — export `useEyedropperTool` and `UseEyedropperToolOptions`.
- Modify: `apps/swillustrator/src/App.tsx` — wire the eyedropper into the tools registry; route picks into the focused swatch.
- Modify: `docs/TODO.md` — strike the eyedropper-stub deferral note.

## Done criteria

- `npm run prepublishOnly` clean (typecheck + tests + tsup build).
- Manual: in Swillustrator dev server, draw two rects of different colors. Click the fill swatch (focus it). Press `I`. Click the red rect → fill swatch turns red. Press `V` (select). Hold alt, click the blue rect → fill swatch turns blue. Release alt → cursor returns to select.
- New tests in `useEyedropperTool.test.ts` all pass; total kit test count rises by ≥ 7.

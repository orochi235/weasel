# Tool overlay channel design

**Date:** 2026-05-03
**Status:** Spec — ready for plan
**Status:** Implemented (with caveats) — channel + Tool overlays shipped per the design; the legacy inline `useMove`/`useResize`/`useRotate` controllers and `buildSceneLayer` overlay fold-in remain in `Canvas.tsx` pending migration of six adapter-driven demos (`MoveDemo`, `ActionsDemo`, `GroupsDemo`, `CloneDemo`, `BezierEditDemo`, `PathPoseDemo`) and their tests. Tracked in `docs/TODO.md` under "Tool primitive follow-ups."
**Predecessor specs:** `docs/specs/2026-05-03-tool-primitive-design.md` (Tool primitive), `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md` (view-aware rendering, screen-space chrome)

## Problem

The Tool primitive promises tools own their behavior — but today they
only own gesture handling, not rendering. Each gesture controller
(`useInsert`, `useAreaSelect`, `useMove`, `useResize`, `useRotate`)
exposes a typed overlay state (`InsertOverlay<TPose>`,
`AreaSelectOverlay`, etc.) that `<Canvas>` reads from a dedicated prop
(`insert={ctl}`, `areaSelect={ctl}`, ...) and renders via dedicated
build functions (`buildInsertOverlayLayer`, `buildAreaSelectOverlayLayer`,
...).

When the Tool wrappers (`useInsertTool`, `useSelectTool`, ...) consume
those gesture controllers internally, the overlay state has no path
to Canvas. Result: in any Tool-primitive demo (WeaselDraw, ZoomDemo,
PanDemo), every gesture overlay is invisible — insert preview rect,
area-select marquee, move ghost, resize ghost, rotate ghost.

The architectural smell: Canvas contains a closed list of "kit-blessed
overlay types," each with its own typed read-path and render function.
Adding a new gesture pattern requires kit edits. Tools can't publish
overlays the kit doesn't already know about.

## Goal

Replace the typed-per-gesture overlay machinery with a single
**overlay channel** on the Tool primitive. Tools publish a
`RenderLayer` directly; Canvas hosts whatever the active tools
publish. Eliminates the closed list. Co-locates rendering with the
tool that owns the gesture.

## Architecture

### Tool surface change

`Tool<TScratch>` gains an optional `overlay` field:

```ts
interface Tool<TScratch> {
  id: string;
  // ... existing fields (drag, click, key, modifier, keybinding, cursor, scratch, etc.)

  /** Optional overlay layer rendered on top of the scene/chrome
   *  whenever this tool is in any active slot (active, modifier, or
   *  alwaysOn). The layer's `draw` function reads from this tool's
   *  scratch via React closure (re-evaluated each render). Return null
   *  from draw to render nothing — typically gated on a scratch field
   *  like `if (!scratch.overlay) return`. */
  overlay?: RenderLayer<unknown>;
}
```

`defineTool({ ..., overlay })` accepts and stores the field. No new
helpers required — `RenderLayer` is the existing kit-wide layer type.

### Tools API surface

`ToolsApi` gains a method for Canvas to enumerate active overlays:

```ts
interface ToolsApi {
  // ... existing fields

  /** All overlay layers from currently-engaged tools (active slot,
   *  modifier slot if engaged, all alwaysOn slot tools). Filters out
   *  tools with no `overlay` field. Order: active, then modifier,
   *  then alwaysOn (in registration order). */
  getActiveOverlays(): RenderLayer<unknown>[];
}
```

Implementation is straightforward: walk the engaged-tool sources,
collect each one's `overlay` field if present.

### Canvas integration

In the layer pipeline, after all configured slots resolve, append
`tools.getActiveOverlays()` to the end. Always-on-top z-order. No
positioning options in v1.

The existing per-overlay slot configs and build functions are
**removed**:

- `InsertOverlaySlotConfig`, `AreaSelectOverlaySlotConfig`, plus their
  `Canvas.layers.insertOverlay` / `Canvas.layers.areaSelectOverlay`
  prop entries.
- `buildInsertOverlayLayer`, `buildAreaSelectOverlayLayer` and their
  call sites in the paint useEffect.
- The `insert={ctl}`, `areaSelect={ctl}`, `move={ctl}`, `resize={ctl}`,
  `rotate={ctl}` Canvas props.
- The `insert?.overlay`, `areaSelect?.overlay`, etc. read paths in
  Canvas's pose-resolution closures (move ghost, resize ghost, rotate
  ghost).

The pose-resolution closures (currently reading `move?.overlay?.poses.get(id)`
to render in-flight previews) need a new path. Two options:

1. **The move/resize/rotate Tool's overlay layer renders the ghost
   directly** (drawing the in-flight pose itself, on top of the scene).
   The scene layer continues drawing committed poses only. The ghost
   visually overlays the original — slight double-draw but visually
   correct since the ghost layer is on top.

2. **The Tool publishes a pose-override callback to the scene closure.**
   More complex, preserves the "scene draws the in-flight pose, no
   ghost layer needed" pattern. Adds a second channel beyond `overlay`.

Pick **(1)**. Keeps the channel minimal: tools publish layers, full stop.
No second pose-override channel. The double-draw is acceptable —
gesture overlays already render with translucent fills today, so the
underlying committed pose showing through is consistent with current
visual behavior. Move/resize/rotate Tool overlays draw the in-flight
ghost in their own layer; scene draws committed state only.

### Theming migration

Today: `<Canvas layers={{ insertOverlay: { fill: 'red', stroke: 'blue', dash: [2,2] } }}>`

After: theming flows through tool options. Each Tool wrapper that
publishes an overlay accepts an `overlayStyle` option:

```ts
useInsertTool(adapter, {
  minBounds: { width: 4, height: 4 },
  overlayStyle: { fill: 'red', stroke: 'blue', dash: [2, 2] },
});

useSelectTool(adapter, {
  // ...
  areaSelectOverlayStyle: { fill: '...', stroke: '...', dash: [...] },
});
```

The Tool wrapper closes over `overlayStyle` when constructing its
overlay's `draw` function. Same shape as today's slot config; just
moves location.

Default styles (the current rgba-greens and rgba-purples) move into
each Tool wrapper's defaults.

## Files to create / modify

**Modify:**

- `src/tools/types.ts` — add `overlay?: RenderLayer<unknown>` to `Tool<TScratch>`.
- `src/tools/defineTool.ts` — pass `overlay` through to the Tool record.
- `src/tools/useTools.ts` — add `getActiveOverlays()` to `ToolsApi`.
- `src/tools/builtin/useInsertTool.ts` — add `overlayStyle` option, build overlay layer reading from `ctl.overlay` via closure, attach to Tool record.
- `src/tools/builtin/useSelectTool.ts` — add `areaSelectOverlayStyle`, `moveOverlayStyle`, `resizeOverlayStyle`, `rotateOverlayStyle` options; the Tool's overlay composes a single layer that renders whichever sub-gesture is in flight (the select tool internally drives multiple gestures via mode-dispatch — the overlay's draw checks each ctl's overlay state and renders the active one).
- `src/canvas/Canvas.tsx`:
  - Remove `insert`, `areaSelect`, `move`, `resize`, `rotate` props.
  - Remove `insertOverlay` / `areaSelectOverlay` slot configs from `LayersConfig`.
  - Remove `buildInsertOverlayLayer`, `buildAreaSelectOverlayLayer`.
  - Replace `insert?.overlay`, `move?.overlay`, etc. reads in pose closures with: scene draws committed state only; in-flight ghosts render via Tool overlays.
  - Append `tools.getActiveOverlays()` to layer pipeline after all slot layers resolve.
- `demo/demos/WeaselDrawDemo.tsx`, `demo/demos/ZoomDemo.tsx`, `demo/demos/PanDemo.tsx` — remove now-stale slot config; verify overlays render via the new channel.

**Other demos** (PathPoseDemo, BezierEditDemo, CompoundPathsDemo, TextDemo, etc.) that currently pass `move={ctl}`, `resize={ctl}`, etc. via the legacy non-Tool API need migration. Two paths:

1. Migrate them to use the Tool primitive (they currently use `tool="select"` shorthand — wire them to `useSelectTool` instead).
2. Keep the legacy ctl-prop API as a fallback during transition; remove in a follow-up.

**Pick (1)** — breaking changes are free at this stage (project memory). Migrate the demos. Less code to maintain.

**Tests:**

- `src/tools/defineTool.test.ts` — accepts and stores `overlay` field.
- `src/tools/useTools.test.tsx` — `getActiveOverlays()` returns overlays from active + modifier + alwaysOn tools; filters out tools with no overlay; correct ordering.
- `src/tools/builtin/useInsertTool.test.ts` — Tool's overlay renders when scratch has an active overlay; respects `overlayStyle`; renders nothing when no gesture in flight.
- `src/tools/builtin/useSelectTool.test.ts` — overlay renders area-select rect during marquee; renders move ghost during move; renders resize ghost during resize; renders rotate ghost during rotate; respects per-mode style options.
- `src/canvas/Canvas.test.tsx` — replaces `insert={ctl}` / `areaSelect={ctl}` integration tests with Tool-primitive equivalents; verifies `getActiveOverlays()` output lands in the layer pipeline; verifies z-order (overlays render above selection chrome).
- Demo integration tests (`WeaseldrawDemo.integration.test.tsx`, `panDemo.integration.test.tsx` if exists, etc.) — extend to assert overlay layers actually appear during a drag.

## Tests required

(Covered above per file.) Net change to `npm test -- --run` baseline
should be roughly neutral or positive — tests for the typed-overlay
machinery get replaced by tests for the channel.

## Deferred / out of scope

Tracked in `docs/TODO.md`:

- **Per-overlay z-positioning.** v1 always renders overlays on top.
  A future tool might want its overlay rendered below selection chrome
  (e.g. a "snap target highlight" that should appear behind handles).
  Add `overlayPosition?: 'top' | 'before-selection' | 'after-selection'`
  field to the Tool record when a real consumer asks.
- **Multiple overlays per tool.** Today the Tool publishes a single
  `RenderLayer`. If a tool needs multiple visually distinct layers
  with different z-positions (e.g. a select tool wanting selection
  handles below the marquee), it composes both into the single
  overlay's `draw` function. If composition becomes painful, promote
  to `overlay?: RenderLayer | RenderLayer[]`.
- **Subscription / push model.** Today the channel is pull (Canvas
  asks each frame, scratch is read via closure). If a tool needs to
  push state changes outside the React render cycle (rare), add an
  imperative `tools.publishOverlay(toolId, layer)` channel.
- **Cursor migration.** This spec only handles overlays. Cursors
  already flow through the Tool primitive via `tool.cursor`. The
  function-form cursor TODO entry (still open) is independent of
  this work.

## Migration notes

- All demos using `<Canvas insert={ctl}>` / `areaSelect={ctl}` / etc.
  must migrate. Project policy: breaking changes are free; no compat
  shim. The plan should enumerate every demo touched.
- The slot config replacement (`<Canvas layers={{ insertOverlay: {...} }}>` →
  `useInsertTool({ overlayStyle: {...} })`) needs to land in every
  affected demo at the same time the slot config is removed from
  `LayersConfig`.
- This is a wide-blast-radius change — likely 20+ files touched. Plan
  in small atomic commits (one Tool wrapper + its tests, then next).

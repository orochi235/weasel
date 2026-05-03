# Viewport (pan-only) + Hand Tool Design

**Status:** Approved 2026-05-03
**Phase:** Tool primitive — Phase 2b
**Depends on:** Phase 1 substrate (merged), Phase 2a built-in tools (merged)
**Defers:** Zoom + chrome/scene scaling policy → Phase 2c

## Goal

Give `<Canvas>` a real pan-able viewport and ship a `hand` Tool that drives it. Pan-only: scale stays at 1, so this is purely a translation. Zoom and the "what stays constant under zoom" policy are explicitly out of scope.

## Motivation

Today `<Canvas>` ignores the kit's standalone viewport primitives (`ViewTransform`, `useZoom`, `usePan`, `worldToScreen`, `screenToWorld`). Demos that want pan either build their own transform layer or apply a CSS scale to a wrapper div (the bezier demo does this). The Tool primitive's modifier slot was designed with space-to-pan in mind but has no `hand` tool to register because there's nowhere to write the pan offset to.

Phase 2b clears the coordinate-plumbing debt with the smallest possible policy footprint, so zoom can layer on later without a viewport-shape redesign.

## Design

### Viewport state

```ts
export interface View {
  x: number;  // world point at canvas top-left
  y: number;
}
```

Convention: `view = {x, y}` is the **world point currently rendered at the canvas's top-left corner**. So:

- `screenX = worldX - view.x`
- `worldX  = screenX + view.x`

Sign convention matches the existing `worldToScreen` / `screenToWorld` primitives. "Where is the camera looking?", not "how far has the canvas been shifted?". Extends naturally to `{x, y, scale}` when zoom lands in Phase 2c.

### Canvas props (hybrid uncontrolled/controlled)

```ts
view?: View                          // controlled — consumer owns state
defaultView?: View                   // uncontrolled initial value (default {x:0, y:0})
onViewChange?: (next: View) => void  // fires in both modes
```

Same pattern as React's `value`/`defaultValue`, and consistent with the kit's `selection`/`tool` patterns. Most demos pass nothing and get a kit-managed pan offset for free; apps that need to persist the camera, sync it across windows, or animate a Cmd+0 reset can take control.

### `RenderLayer.space` field

```ts
interface RenderLayer {
  draw: (ctx: CanvasRenderingContext2D, …existing args…) => void;
  space?: 'world' | 'screen';  // default 'world'
}
```

Canvas's render loop applies the right transform per layer:

- `space: 'world'` (default) → `ctx.setTransform(1, 0, 0, 1, -view.x, -view.y)` then `draw(ctx, …)`. The layer renders in world coordinates and the viewport is applied for it.
- `space: 'screen'` → `ctx.setTransform(1, 0, 0, 1, 0, 0)` then `draw(ctx, …)`. The layer renders in screen coordinates and computes its own positions via `worldToScreen(worldPt, view)`.

Kit-built chrome factories opt in to `'screen'`:

- `createSelectionOverlay` / selection handles
- `createCornerHandlesLayer` (resize handles)
- rotation-handle layer
- marquee/area-select layer
- grid-cell-hover highlight (debatable — keep `'world'` for now since the underlying grid is in world space)

Consumer-built layers don't touch the field and Just Work — their existing world-space draw calls keep rendering at the right place because Canvas applies the transform for them.

`view` is passed to chrome layers via the existing `LayerCtx` (or whatever hook each factory takes), so they can call `worldToScreen(pt, view)`.

### Pointer→world conversion

The default `clientToWorld` on `<Canvas>` routes through `screenToWorld`:

```ts
worldX = (clientX - canvasRect.left) + view.x
worldY = (clientY - canvasRect.top) + view.y
```

ToolCtx already exposes `worldX` / `worldY` to handlers; this is computed using the current `view` so tools transparently see world coordinates regardless of pan offset.

### `ToolCtx` additions

```ts
interface ToolCtx<TScratch> {
  // …existing fields…
  view: View;
  setView: (next: View) => void;  // calls onViewChange or internal setter
}
```

Tools that need viewport access (the hand tool, future zoom-reset tool, future minimap interactions) read/write through these fields rather than prop-drilling.

### Hand tool (`useHandTool`)

A single Tool record registered in **both** slots — active (sticky, `H` key) and modifier (momentary, `space` trigger). The dispatcher already handles space-modifier engagement; the hand tool just needs to declare both `keybinding: 'H'` and `modifier: 'space'`.

Scratch:
```ts
type HandScratch = { startView: View; startClientX: number; startClientY: number } | null;
```

Channels:
- `drag.onStart` — capture `startView = ctx.view`, `startClientX/Y = e.clientX/Y`. Return `'claim'`.
- `drag.onMove` — compute `dx = e.clientX - startClientX`, `dy = e.clientY - startClientY`. New view = `{ x: startView.x - dx, y: startView.y - dy }` (sign-flipped because dragging right = camera moves left). Call `ctx.setView(next)`. Return `'claim'`.
- `drag.onEnd` / `drag.onCancel` — clear scratch. No commit needed (view changes are not undoable, by design).
- `cursor` — `'grab'` idle, `'grabbing'` while scratch is non-null.

Pure pointer-on-empty selection from the select tool is not affected: hand owns the active slot when active, and momentary engagement via space takes the modifier slot ahead of select. When neither is engaged, select still gets the events.

### Deprecate `usePan`

`src/features/viewport/usePan.ts` is `React.MouseEvent`-based and uses the inverse sign convention (additive translate, not camera position). The new hand tool does not use it. Mark it `@deprecated` in JSDoc with a pointer to `useHandTool`. Don't physically delete: it remains exported from `src/index.ts` and is referenced by the bezier-zoom design doc. Removal can ride with Phase 2c when zoom lands and the bezier demo migrates off the CSS-scale hack.

## Testing surface

**Unit**
- Pan math: drag deltas produce expected `view` updates with correct sign.
- Controlled mode: passing `view` overrides internal state; `onViewChange` fires; internal state is not used.
- Uncontrolled mode: `defaultView` initializes; internal state mutates; `onViewChange` still fires.
- `screenToWorld` integration: `worldX/worldY` on `ToolCtx` reflect current view.

**Integration**
- Active-slot: pressing `H` activates hand; click-drag pans.
- Modifier-slot: holding `space` engages hand momentarily; release returns to prior tool.
- Chrome stays screen-locked while a panned scene scrolls underneath (visual smoke via integration test asserting screen-space layer's `setTransform` call args).
- `select` tool still works on body-empty pointerdown when hand is not engaged.

**Visual / demo**
- One demo (bezier or a new minimal pan demo) wired with `useHandTool` + Canvas viewport props, replacing any current pan workaround.

## Out of scope (explicit deferrals)

These are listed so reviewers don't expect them and so Phase 2c has a starting list:

- Zoom (wheel-zoom, pinch-zoom, `view.scale`).
- `handleHitRadius` semantics change (currently world-px; will need to become screen-px once scale ≠ 1).
- `drawOne(ctx, obj, pose, view)` signature for consumer-controlled stroke scaling under zoom.
- Pan-bounds / clamping policy.
- Inertial pan / momentum.
- `Cmd+0` reset (trivial to add later as a separate alwaysOn Tool).
- Removing `usePan` (deferred to Phase 2c).

## Open questions resolved during brainstorm

- **Scope:** B (pan-only Canvas integration). Zoom split out in TODO under "viewTransform integration — zoom".
- **State ownership:** C (hybrid uncontrolled/controlled).
- **Activation:** C (active slot `H` + modifier slot `space`, one Tool record).
- **Coordinate convention:** A (`view = {x, y}` = world point at canvas top-left).
- **Pan primitive reuse:** rewrite. Inline drag math in `useHandTool`; deprecate `usePan` without deleting.
- **Two-pass rendering:** B (layer factories declare `space`).
- **`handleHitRadius` semantics:** A (defer; revisit under Phase 2c).

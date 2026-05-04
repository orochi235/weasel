# Tool Primitive Phase 2c — Zoom + Chrome Screen-Space

**Status:** Approved 2026-05-03
**Phase:** Tool primitive — Phase 2c
**Depends on:** Phase 2b viewport + `useHandTool` (merged)
**Defers:** Inertial pan, debug overlay primitives, pan-bounds policy → follow-on work

## Goal

Add zoom to the viewport and finish the chrome screen-space story so handles/marquees stay screen-px constant under non-1 scale. Ship explicit zoom built-in tools (wheel + keyboard) and the consumer-facing `view` arg on draw signatures so apps can pick stroke-scaling policy. Physically remove `usePan` and migrate the bezier demo.

## Motivation

Phase 2b wired pan but kept `view.scale = 1` implicit and left chrome layers in world space. Under zoom this falls apart: 32-px selection handles become 8 px at 4× zoom, marquee outlines hairline, hit radii misbehave. The infrastructure (`RenderLayer.space`) already exists; 2c spends the policy budget to flip chrome and adds the remaining math.

## Design

### View shape

```ts
export interface View {
  x: number;        // world point at canvas top-left
  y: number;
  scale: number;    // pixels per world unit; default 1
}
```

Default view is `{x: 0, y: 0, scale: 1}`. Coordinate conversions:

- `screenX = (worldX - view.x) * view.scale`
- `worldX  = screenX / view.scale + view.x`

`viewToTransform` (the legacy adapter) updates to `{ panX: -view.x * view.scale, panY: -view.y * view.scale, zoom: view.scale }`. `worldToScreen` / `screenToWorld` get the scale factor in their math.

### `zoomAt` primitive

Pure function shared by every zoom code path:

```ts
export function zoomAt(view: View, anchor: { x: number; y: number }, factor: number, opts?: { min?: number; max?: number }): View {
  const nextScale = clamp(view.scale * factor, opts?.min ?? 0.1, opts?.max ?? 8);
  // Anchor is in screen coords; world point under anchor must stay put.
  const worldX = anchor.x / view.scale + view.x;
  const worldY = anchor.y / view.scale + view.y;
  return {
    scale: nextScale,
    x: worldX - anchor.x / nextScale,
    y: worldY - anchor.y / nextScale,
  };
}
```

Unit-tested independently. Wheel zoom anchors at cursor, keyboard zoom anchors at canvas center; both call this.

### Built-in tools

Three new `defineTool` records, all opt-in via `useWheelZoomTool()` / `useKeyboardZoomTool()` / `useWheelPanTool()` registration calls (no auto-registration). All read/write the viewport via `ctx.view` / `ctx.setView`.

**`useWheelZoomTool`** — alwaysOn slot, claims wheel when `e.ctrlKey === true` (covers Cmd+wheel on macOS *and* trackpad pinch, which the browser synthesizes as ctrl+wheel). Anchor: cursor (`{x: e.clientX - rect.left, y: e.clientY - rect.top}`). Factor: `Math.pow(wheelStep, -e.deltaY / 100)` where `wheelStep` defaults to 1.1. Calls `e.preventDefault()` on claim to suppress browser zoom.

**`useKeyboardZoomTool`** — alwaysOn slot, claims keyboard `Cmd+=`, `Cmd+-`, `Cmd+0`. Anchor: canvas center. Factor: `keyStep` (default 1.25) for `=`/`-`; `Cmd+0` resets to `{x: 0, y: 0, scale: 1}`.

**`useWheelPanTool`** — alwaysOn slot, claims wheel when `e.ctrlKey === false`. Translates `view` by `(e.deltaX / view.scale, e.deltaY / view.scale)` so a one-screen-pixel scroll moves one screen pixel regardless of zoom.

All three accept config opts (`min`, `max`, `wheelStep`, `keyStep`) so consumers can override. Default thresholds: scale ∈ [0.1, 8], wheelStep 1.1, keyStep 1.25. No pan-bounds policy.

### `RenderLayer.draw` signature change (breaking)

```ts
interface RenderLayer<TData> {
  draw: (ctx: CanvasRenderingContext2D, data: TData, view: View) => void;
  space?: 'world' | 'screen';
}
```

`view` is always present (no longer optional). Layers in `'world'` space ignore it almost always; layers in `'screen'` space use `worldToScreen(pt, view)` to position screen-locked chrome over world content. Consumer-built `'world'` layers that want zoom-aware stroke widths divide `lineWidth` by `view.scale` themselves.

### `drawOne` signature change (breaking)

`SceneSlotConfig.drawOne` and the equivalent on `arrayAdapter`:

```ts
drawOne: (ctx: CanvasRenderingContext2D, obj: T, pose: Pose, view: View) => void;
```

Bare positional `view` arg, not a wrapper context object. Reasoning: the first arg is already the rendering context; piling more "context" on top creates a naming collision. Positional matches `draw` and stays cheap. Consumers pick stroke policy: `ctx.lineWidth = 2 / view.scale` for screen-px strokes, plain `ctx.lineWidth = 2` for world-px (Illustrator-style scale-with-zoom).

### Chrome flips to `space: 'screen'`

Kit factories that opt in to screen space:

- `createSelectionOverlay` (selection rectangle outline)
- selection corner-handles layer
- rotation-handle layer
- marquee / area-select layer
- (future) anchor-dot / vertex-handle overlay

Stays `'world'`:

- `createCellHighlightLayer` (grid hover) — the underlying grid is in world space; the highlight scales with it. Re-evaluate if a consumer complains.
- All consumer scene layers (default).

Each flipped factory takes `view` from its draw arg and runs its draw calls in screen coords, calling `worldToScreen(worldPt, view)` to position the chrome.

### `handleHitRadius` semantics (breaking)

Today `handleHitRadius` is interpreted in world units. Under zoom this means handles get harder to hit at small scale and trivial to hit at large scale. Flip to screen-px: divide by `view.scale` at hit-test time so the hit radius matches the visually rendered handle size.

This is breaking for consumers who tuned the value, but the new semantics are what they almost certainly meant.

### Pointer→world conversion

Default `clientToWorld` on `<Canvas>` uses the new scale-aware formula:

```ts
worldX = (clientX - rect.left) / view.scale + view.x
worldY = (clientY - rect.top)  / view.scale + view.y
```

`ToolCtx.worldX/worldY` flow through this transparently; tool authors don't need to think about scale.

### Remove `usePan` and migrate bezier demo

`src/features/viewport/usePan.ts` was `@deprecated`'d in 2b. 2c deletes it from the source tree and removes the `src/index.ts` re-export. Bezier demo migrates from its CSS-scale wrapper to `useHandTool` + `useWheelZoomTool` + Canvas viewport props. The `bezier-zoom` design doc that referenced `usePan` either gets pruned or rewritten to point at the new tool stack.

## Forward compatibility

### Inertial pan

Not in 2c, but the architecture should keep the path clear. Implementation when ready: `useHandTool.drag.onEnd` samples velocity from the last few `onMove` events, then schedules a detached `requestAnimationFrame` loop that calls `ctx.setView` with a decaying offset until below threshold. Two requirements 2c honors:

1. `ctx.setView` stays callable any time, not gated on an in-flight gesture. (Already true.)
2. No clamping logic gets baked into `useHandTool` itself. Any future bounds policy goes in a separate `clampView` helper that both hand and inertial paths can call.

### Debug overlay primitives

Tracked as the next TODO item after 2c lands. The `space: 'screen'` infrastructure 2c finishes is what the debug overlay will use to render hitboxes/handle bounds in screen coords on top of a panned/zoomed scene.

## Testing surface

**Unit**
- `zoomAt`: anchor invariance (the world point under the anchor stays put across the zoom), clamping at min/max, identity at factor=1.
- Pointer→world conversion under non-1 scale.
- `viewToTransform` round-trip with scale ≠ 1.
- `handleHitRadius` hit-test under non-1 scale.

**Integration**
- Wheel + ctrl/cmd zooms about the cursor.
- Wheel without ctrl pans by `(deltaX/scale, deltaY/scale)`.
- `Cmd+=` / `Cmd+-` / `Cmd+0` zoom about center / reset.
- Selection handles render at constant screen size across two zoom levels (visual smoke via `setTransform` call args).
- Pan after zoom, then zoom again — view stays consistent.

**Visual / demo**
- Bezier demo migrated, no CSS-scale wrapper.
- One zoom-aware demo showcasing both stroke policies (scale-with-zoom vs screen-pinned) via the new `view` arg on `drawOne`.

## Out of scope (explicit deferrals)

- **Pan bounds / clamping policy.** Add when a real consumer asks; will live in a separate `clampView` helper.
- **Inertial pan / momentum.** See "Forward compatibility" above.
- **Debug overlay primitives.** Next TODO item; uses 2c's screen-space chrome infra.
- **Per-axis zoom** (e.g. timeline charts where x-zoom and y-zoom differ).
- **Animated zoom transitions** (smooth Cmd+0 reset). Trivial layer on top of `setView`.
- **Pinch-zoom on touch devices that *don't* synthesize ctrl+wheel.** Pointer-event-based pinch is a separate gesture pattern.

## Open questions resolved during brainstorm

- **View shape:** `{x, y, scale}` extending 2b's `{x, y}`.
- **Wheel zoom trigger:** ctrl/cmd-modified wheel (covers trackpad pinch via browser-synthesized ctrl+wheel). Plain wheel pans.
- **Tool registration:** explicit opt-in (`useWheelZoomTool()` etc.), not auto-bundled.
- **Zoom anchor:** cursor for wheel, canvas-center for keyboard.
- **Shared primitive:** `zoomAt(view, anchor, factor)` used by both zoom tools.
- **Chrome screen-space:** selection overlay, handles, rotation handle, marquee. Grid stays world.
- **`drawOne` signature:** bare positional `view` arg, not a context wrapper.
- **`handleHitRadius`:** screen-px (breaking).
- **Pan bounds:** none.
- **`usePan`:** physical removal, bezier demo migrates.

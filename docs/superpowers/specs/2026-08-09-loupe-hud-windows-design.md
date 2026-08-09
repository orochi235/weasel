# Loupe, and the hud window primitive it needs

Design for a **loupe** — a magnifier panel that shows a zoomed view of whatever
the pointer is over, for placing anchors, checking seams, and reading colors at
pixel accuracy without moving the camera. For anyone implementing it, or
implementing the next floating panel over a weasel canvas.

The loupe is mostly an instance of something more general. `@weasel-js/hud`
(WebGL-drawn chrome compositing into a weasel canvas) has no draggable frame,
and `@weasel-js/ui` has no floating window. This design adds the frame to hud
and builds the loupe on it.

## What goes where

Three collaborating parts, split along one hard line: **a hud widget cannot see
the scene.** `HudDrawCtx` is `{ dims, defaultFont, tokens }` — no scene data, no
view — and that is what lets a hud render headlessly and identically. So the
frame is hud and the magnified content is not.

**`hud.window()`** is a new hud widget owning the frame: titlebar, eight
border/corner grab zones, a close box, move and resize drags, min size, and a
`contentRect` (bounds minus frame and titlebar). It is a single `Widget`
resolving its own zones internally, because hud's `findTopmostHit` returns one
widget from a flat list and sub-zone resolution has nowhere else to live. Drags
need no new routing — the existing `hud.press` / `hud.drag` / `hud.release`
actions in `packages/hud/src/tool.ts` already pump `down`/`move`/`up` to any
widget that returns `'claim'`.

**Content painters** fill the window. A window takes
`content: (ctx: { data, view, dims, rect }) => DrawCommand[]`, drawn beneath the
frame *within the hud's own layer* and clipped to `contentRect`. The hud layer
already receives `(data, view, dims)` and discards them (`attach.ts:51`), so
this needs no new plumbing and does not widen `HudDrawCtx`. The escape hatch is
explicit, typed, and lives on the composite rather than on every widget.

It must be the same layer, not a second registered one. Registration order is
draw order and the last-registered layer is on top (`Canvas.tsx:834`), so a
window created after `attachHud` would paint its content over its own frame. One
layer also makes frame/content desync structurally impossible during a drag.

**`createLoupe()`** is a window plus a content painter, plus a DOM control strip.

## Two content modes

The loupe magnifies either the re-rendered scene or the actual framebuffer, and
it needs both, because neither one answers both questions honestly.

**Vector** is a `createViewportLayer`
(`packages/core/src/features/viewports/`, `@experimental`) whose `bounds` thunk
returns the window's `contentRect`, with an inner view centered on the pointer at
`outer.scale × factor`. The thunk is re-evaluated every frame, so move and resize
need no wiring. Crisp at any magnification — right for placing anchors and
checking seams.

**Pixel** reads back the live framebuffer (`preserveDrawingBuffer: true` is
already set at `Canvas.tsx:1418`), sampling a `w/factor × h/factor` device-pixel
region into an `ImageBitmap` drawn at `contentRect`.

Vector mode cannot serve a color picker: re-rendering at 8× produces different
coverage along every antialiased edge, so the color it shows is not the color on
screen. Pixel mode cannot serve anchor placement: it magnifies a 2× buffer and
goes soft past 2–3×. One mode would silently give a wrong answer to one of the
two jobs.

## Interaction

The frame is parked and the pointer aims it. A frame that chases the cursor
cannot be grabbed by its borders.

While the pointer is over the window, content freezes at its last sample — that
is what makes the borders reachable.

Presses inside the content area are claimed and swallowed.
`createViewportLayer` documents that hit-test re-projection is unwired, so a
click inside the loupe would target the outer view and act on whatever sits
under the loupe on the real canvas. Swallowing is the correct behavior until
re-projection lands; interacting *through* the loupe is a later feature that
depends on it.

## Controls

`✕` is a hud button in the GL titlebar — it must travel with the frame.
Everything else is DOM in `ToolOptionsBar`: the vector/pixel toggle, the scale
stepper, and the hex readout with a copy affordance. DOM gives those focus,
keyboard, ARIA, tooltips, and theme variables for free.

A DOM *frame* was rejected and should stay rejected: the border would paint on
the browser's schedule while the content moved on the rAF schedule, so the
magnified image would visibly slide inside its own border during a resize.

## Not a tool

Nothing here needs a `Tool`. The hud tool is already ambient and handles every
window interaction, so the loupe occupies no active tool slot, sets no cursor,
and does not participate in tool eligibility or modes.

The visible consequence: `ToolPalette` renders from `tools: ToolsApi`
(`ToolPalette.tsx:55`), so the loupe cannot take a palette slot. The app owns
its toggle and keybinding — in `ToolOptionsBar`, a view menu, or the status bar.

Aiming needs its own pointer feed. hud's hover arrives via the layer's
`onUncapturedMove`, which stops during a captured drag — precisely when the
loupe matters most, mid-anchor-placement. The loupe attaches its own
`pointermove` listener to the canvas host, independent of capture.

## Prerequisite in core

Pixel mode does not work today. `GLImageCache` hardcodes `TEXTURE_MAG_FILTER` to
`LINEAR` (`packages/core/src/renderer/cache/GLImageCache.ts:57`), so a magnified
readback comes out blurry — the exact failure pixel mode exists to avoid. It
needs a sampling option on `ImageDrawCommand` threaded through to `NEAREST`.

## Testing

`hud.window()` unit-tests like the other widgets: zone resolution at each
border and corner, min-size clamping, claim behavior per zone, and the
`down`/`move`/`up` sequence producing the expected bounds. Content painting
tests by asserting the emitted `DrawCommand` tree — one clipped group at
`contentRect`, content children before frame children. The loupe's inner-view
derivation is pure math and tests without a GL context. Pixel mode needs an
integration test with a real context; the `NEAREST` change wants a visual
baseline, since blurry-vs-crisp is the whole point and no assertion on draw
commands would catch a regression.

## Also unlocked

The same window hosts a minimap (different inner view) and a reference-image
pane (the existing `image` widget as content). Neither is in scope here, but
both fall out of the primitive, which is the check that the primitive is cut in
the right place.

## Fix in passing

`packages/hud/src/widget.ts:27` says hover is driven by a direct DOM listener in
`attachHud`. It isn't, and hasn't been since the dispatcher change — it's
`onUncapturedMove` on the layer. The loupe's aiming feed makes the distinction
load-bearing, so correct the comment while here.

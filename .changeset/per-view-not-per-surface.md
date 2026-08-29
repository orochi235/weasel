---
'@weasel-js/core': patch
---

Layers and deps answer for the view they are drawn for

Nine lookups closed over the *surface's* state at construction, so they answered
for view zero in every view. `<CanvasView>` draws the surface's layer array
unchanged and only the draw envelope differs, which makes a `draw: (_data, …)`
a guarantee of answering for the wrong view rather than merely an unused
argument. A drag in view B ghosted in view A, the marquee painted in the wrong
view, chrome-caps resolved against the surface's selection, every Cmd+V centered
on the wrong camera, and Escape in view B cancelled view A.

**New on `CanvasViewHelpers`** — `getPreviewSources()`, `getGestureOverlays()`
and `getIsVisible()`. All three are **required members**: anyone hand-writing a
`CanvasViewHelpers` (a test double, a wrapper) has to add them.
`getIsVisible` **moves off `CanvasSurfaceHelpers`**, where it could only ever
have answered for one view.

**New on `GestureSource`** — `previewSources()` and `overlays()`, also required,
alongside the newly exported `GesturePreviewSource`. `toolPreviewSources(tools)`
is the tool half.

**Layer options changed.** `createPathEditingOverlayLayer` and
`createSlopsDebugLayer` take `getPose(id, previews)` and have lost their
`isVisible` / `selectionRef` / `boundsOf` options — those come off the envelope
now. `usePreviewGhostLayer` has lost `tools`. Both it and
`useDispatcherOverlayLayer` keep `dispatcher` **only** to subscribe for repaint.

**Picking takes a camera.** `pickEvery`, `pickBest` and `makeGetNodeAtPoint`'s
result accept an optional trailing `PickCamera`. A world point does not carry
the scale it was produced under and picking has no draw envelope, so the caller
that produced the point supplies it; omitting it keeps the surface camera.

`useHoverTracking` took a `clientToWorld` thunk beside a world-space
`getNodeAtPoint` — the first resolved the view and the second did not, so hover
picked at the surface's scale inside a panel. It takes one
`nodeAtClientPoint(clientX, clientY)` now.

Anchor-editing target state stays surface-wide; only the preview resolution on
that path is per-view.

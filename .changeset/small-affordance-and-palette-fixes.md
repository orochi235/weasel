---
'@weasel-js/core': patch
'@weasel-js/hud': patch
'@weasel-js/ui': patch
---

Five unrelated small fixes.

A tapered stroke with `align: 'inner'` or `'outer'` on a polygon path painted
at half its requested widths. That alignment renders by tessellating at twice
the width and stencilling half away, and the doubling reached `stroke.width`
but not `vertexWidths`. The doubled array is memoized per source array, since
the ribbon cache compares it by reference.

An image insert now previews as its destination box while the drag is live,
the way the other kit insert kinds do; it used to commit on release with no
preview at all.

A HUD `button` answers `cursorAt` with `'pointer'`, overridable per button.
Hovering one while a drawing tool was active kept showing that tool's cursor.
The other widgets are decoration and the hit-test walk descends past them, so
they stay silent.

`composeAffordanceLayer`'s `hitTest` returns a `LayerHit`, carrying the hit
region's declared cursor and claim instead of dropping them. `AffordanceRegion`
gains optional `strength` / `claimedKinds` to declare that claim.

`ToolPalette` uses the shared `useRovingTabIndex` rather than its own container
handler, so arrow keys skip tools that are ineligible in the current mode and
the tab stop no longer sits on one. `ToolButton` takes an `onKeyDown`.

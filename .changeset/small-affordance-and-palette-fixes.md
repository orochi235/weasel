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

An image insert previews the decoded bitmap inside the drag bounds instead of
committing on release with no preview at all. It falls back to the bare
outline until the image decodes, and `useImageTool({ preview: 'outline' })`
opts out of the bitmap entirely.

A HUD widget that claims the pointer reports a `'pointer'` cursor without
implementing anything — hovering one while a drawing tool was active used to
keep showing that tool's cursor. The rule is keyed on the `claims` every
widget already declares, so it covers consumer-authored widgets too;
decoration claims nothing and the hit walk descends past it. A widget's own
`cursorAt` still wins, and `button` takes a `cursor` option that feeds it.

`composeAffordanceLayer`'s `hitTest` returns a `LayerHit`, carrying the hit
region's declared cursor and claim instead of dropping them. `AffordanceRegion`
gains optional `strength` / `claimedKinds` to declare that claim.

`ToolPalette` uses the shared `useRovingTabIndex` rather than its own container
handler, so arrow keys skip tools that are ineligible in the current mode and
the tab stop no longer sits on one. `ToolButton` takes an `onKeyDown`.

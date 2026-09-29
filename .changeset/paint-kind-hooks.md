---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

New hooks `usePaintKinds()`, `useGradientKinds()` and `usePaintKind(id)` read
the paint-kind registry and re-render when a kind is registered or removed.
`PaintInput`, `GradientEditor` and `PaintField` use them, so a kind registered
after they mount — a consumer's own, or one arriving through
`registerPaintKindLoader` such as the lazily loaded mesh gradient — shows in the
kind bar and gets its label and editor without waiting for an unrelated
re-render. `listPaintKinds()` and `listGradientKinds()` now return the same
array until the registry changes.

`<Canvas>` no longer paints the inputs of a render React abandoned: a
`startTransition` that suspends used to leave its layers, size and paint target
behind for the next redraw to draw. A `syncPaint` redraw requested from a layout
effect that runs before the canvas's own — an earlier sibling's — now paints
that commit's inputs rather than bailing until the canvas's effect ran.

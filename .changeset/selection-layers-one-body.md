---
'@weasel-js/core': patch
---

`createSelectionOutlineLayer` and `createSelectionHandlesLayer` now do what the overlay layer does

`createSelectionOverlayLayer` documents itself as equivalent to stacking the
other two, and it was not. It reads `ChromeState` off the draw envelope,
resolves the synthetic multi-resize id to the union AABB, honors chrome-caps
visibility and suppressed ids, and takes selection and poses from the envelope
when they are omitted. The two primitives did none of that: they ignored the
draw envelope entirely, required a construction-time `getPose` cascade, and
knew nothing about the multi-selection union — so a consumer who stacked them,
on the wrapper's own promise, got chrome in the wrong place with no way to
tell.

All three now run one body and differ only in which passes they enable, so the
promise holds by construction. `SelectionOutlineLayerOpts` and
`SelectionHandlesLayerOpts` become the overlay's option set minus the visuals
that don't apply, which makes `getSelection` and `getPose` optional on both and
adds `getOutlineIds` and `getSuppressedIds`. Handle visuals are now the named
`SelectionHandleStyle`.

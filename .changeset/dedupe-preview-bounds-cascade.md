---
'@weasel-js/core': patch
---

Answer chrome bounds and layer-helper bounds with one function.

`buildChromeState`'s `effectiveBoundsOf` and `CanvasHelpers.getEffectiveBounds`
each spelled out the same cascade — the active tool's published preview, then
the dispatcher's preview extras, then committed bounds — in two places that had
to agree for a resize handle to sit on the shape it belongs to. They now share
`boundsWithPreview`.

The helpers copy carried an extra committed-pose fallback for when no bounds
resolver is wired. That branch was unreachable: a missing resolver means no
`boundsOf` prop and no adapter, and without an adapter the pose lookup returns
`null` too. Behavior is unchanged.

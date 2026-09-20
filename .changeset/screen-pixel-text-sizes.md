---
'@weasel-js/core': patch
'@weasel-js/paint': patch
'@weasel-js/text': patch
'@weasel-js/svg': patch
---

Accept `{ px }` screen-pixel sizes for `fontSize` and `letterSpacing`

`TextStyle.fontSize`, `TextStyle.letterSpacing` and their `StyledRun`
counterparts now take `number | { px: number }`, the spelling `Stroke.width`
and `MarkerRef.size` already had. A `{ px }` size holds its on-screen size as
the view zooms, so a label no longer divides by the view scale at the call
site.

The unit is one type and one resolver now: `ScreenLength` and
`resolveScreenLength` live in `@weasel-js/paint`, which both core and text
already depend on, and `resolveStrokeWidth` delegates to it.

Resolution happens at the entry to layout, not at draw time. A screen-pixel
size changes the glyph advances and so the wrap points and the measured
bounds, so `resolveTextStyle`, `resolveRuns`, `textPoseLayoutInput`,
`layoutTextPose`, `measureTextBounds` and the three command builders
(`textCommand`, `textCommandFromRuns`, `textCommandFromPose`) each take the
view scale, defaulting to 1. `ResolvedTextStyle` and `ResolvedRun` keep plain
world numbers, so everything downstream is unchanged.

`createTextLayer` passes the mean of `view.scale.x` and `view.scale.y`, so
non-scene text gets this with no consumer change. The `kit:text` node painter
deliberately does not: it memoizes on `(data, pose)` to keep the renderer's
layout cache hitting across frames, and keying that on the live camera would
miss on every zoom frame.

SVG serialization writes a `{ px }` size as that many user units — SVG user
space has no camera — and the fit clamp on import leaves one alone, since a
screen-pinned size is not the file's to scale.

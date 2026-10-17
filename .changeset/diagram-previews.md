---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

An `EffectRun` can carry a picture per output: `previews: { [port]: ImageBitmap }` on a stage's entry. A look's `showPreviews` option (on `nodeGraph`, `rack` and `lanes`) keeps a slot per output, `previewSize` big (default `PREVIEW_SIZE`, a 48-unit square, or `{ width, height }`), laid out from the first draw so a run filling it never lays the chart out again. Until a run fills a slot it draws as an empty frame, and it fades with its stage. `paintRun` fills it by a data edit, so a run that hands back the same bitmap writes nothing to the scene and uploads nothing; `EffectChart` frees the texture of a bitmap the next run no longer shows, and of every one it shows when it unmounts. `RunRowOptions` is the shared type of `showValues`, `showPreviews` and `previewSize`, and `previewRowId(port)` names a slot.

`bitmapSrc(bitmap)` (renderer, re-exported by core) names an `ImageBitmap` made at runtime as an image `src`, so an image node draws it with no load. The same bitmap always gets the same name; the cache holds it weakly and never drops it to fit its budget, and `releaseImage` frees its textures and retires the name.

A body's `slot` row takes a `width`: the body is at least that wide and the slot's box is that wide, centered. In `diagramScene`, a slot with an `id` becomes a scene node of that name, an empty frame, ready to be filled by a data edit. `DiagramSceneData` gains `image`.

`lanes` widens a source or sink stretched taller than it measured, so its round ends no longer eat into its rows.

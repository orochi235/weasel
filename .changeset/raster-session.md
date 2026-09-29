---
"@weasel-js/core": patch
---

New `createRasterSession()` keeps one renderer and its GPU caches across any
number of headless renders, for rendering thumbnails or pages in bulk: shader
programs compile once and a bitmap uploads once for the whole batch rather than
per render. `session.render(args)` takes what `renderSceneToPixels` takes minus
`gl`/`createCanvas`, which go to `createRasterSession({ gl?, createCanvas? })`;
scenes, source rects and scales may differ per render, and a session that owns
its canvas grows it to the largest render so far. `session.dispose()` frees
every GL object the session created and leaves a caller-owned context open.
Additive; new exports `createRasterSession`, `RasterSession`,
`RasterSessionOptions`, `RasterRenderArgs`.

`renderSceneToPixels` is now a session opened for one render. Behavior is
unchanged, except that it no longer leaks on a caller-owned context: each call
used to leave 12 shader objects and every uploaded bitmap texture behind.
`WeaselRenderer.dispose()` now frees bitmap and pattern textures and persistent
meshes too, and compiled shaders are freed with their program.

---
"@weasel-js/core": patch
---

A mesh-gradient paint now bakes at a resolution fitting the device pixels it covers, in power-of-two buckets from 32 to 2048 texels (and never above the context's `MAX_TEXTURE_SIZE`), instead of a fixed 256. A mesh filling a poster, zoomed in on screen, or printed through `renderSceneToPixels` at a high scale no longer shows its texels. Bakes are cached per paint and bucket in a bounded least-recently-used cache (64 MiB or 256 bakes per renderer), and their textures are freed on eviction, on `WeaselRenderer.dispose()`, and on a context restore.

Additive: `PaintBindContext` gains `spaceToDevice(units)`, `maxTextureSize` and `resources`, a `PaintResources` lifetime a registered paint kind keys its GPU caches on and frees them through `onRelease`. `PaintResources` is exported from `@weasel-js/core`; `meshBakeSize`, `MESH_BAKE_MIN` and `MESH_BAKE_MAX` from `@weasel-js/core/mesh`. Code that constructs a `PaintBindContext` itself, such as a test double, has to supply the three new members.

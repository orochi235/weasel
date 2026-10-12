---
'@weasel-js/parallax': patch
'@weasel-js/core': patch
---

parallax: a new package over core, holding the paint-side parallax and tiling layers. `createParallaxLayer` draws render layers through a derived view, `createParallaxPlane` is the live plane a camera or an animator drives, and `createTiledLayer` with `tiledProject` repeats its sources across a period. It depends on `@weasel-js/registry`, with `@weasel-js/core` as a peer, and has no React.

**Breaking for `@weasel-js/core`:** `createParallaxLayer`, `createParallaxPlane`, `createTiledLayer`, and `tiledProject`, with their types (`CreateParallaxLayerOpts`, `ParallaxSource`, `ParallaxPlane`, `CreateTiledLayerOpts`, `TileBleed`, `TilePeriod`, `TileRange`), are no longer exports of `@weasel-js/core`. Import them from `@weasel-js/parallax`.

The parallax math stays in core, which a scene layer's own `parallax` uses: `deriveParallaxView`, `planeMap`, `toPlane`, `fromPlane`, `rectToPlane`, `rectFromPlane`, `planeToPlane`, `planeMatrix`, and the types `ParallaxOpts`, `ScalarOrXY`, and `PlaneMap`.

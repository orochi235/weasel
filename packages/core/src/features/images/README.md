# images

One file: the kit's per-`src` image loader and cache.

## The problem it solves

Shape painters are **synchronous** — `kit:image` in `NodeShape.ts` has to
return draw commands now — but decoding an image is **async**. `imageCache`
bridges the two without making the painter async:

- `getImageBitmap(src)` is a synchronous read. It returns the decoded
  `ImageBitmap` if one is ready, and otherwise returns `undefined` *and*
  kicks off a de-duped load in the background.
- `subscribeImageReady(fn)` fires when any load resolves or errors.
  `<SceneCanvas>` subscribes and calls `requestRedraw()`, so the painter
  re-runs and this time gets a bitmap.

So the first frame draws nothing for that node and the next one draws the
image. No promise ever crosses into the render path.

## Why the bitmap isn't in node data

The decoded bitmap lives **only here**, keyed by `src`. Node `data` holds just
the `src` string, which is why `scene.toJSON()` round-trips untouched — an
`ImageBitmap` is not serializable. Keep it that way: putting a decoded bitmap
on a node would break persistence and the clipboard.

`src` is any browser-loadable image string — a remote URL, a `blob:` URL, or a
`data:image/…;base64,…` URI (the embedded-bytes path used by
[`../ingestion`](../ingestion/README.md) when it inlines a dropped file).

## SVG sources

An SVG source (`isVectorImageSrc`) has no single right raster. `kit:image`
passes `getImageBitmap` the size it is about to draw the image at, in device
pixels, and the cache re-rasterizes in power-of-two steps — up when the drawn
size passes the current raster, down only once it is four times too big, one
raster in flight per `src`, capped by the smallest live renderer's
`MAX_TEXTURE_SIZE` and 4096×4096 pixels. The old raster is returned until the
new one lands, then its GL texture is freed in every renderer. The SVG is
decoded into an `<img>` once and each raster is a canvas `drawImage` of it.

## Note

The cache is process-global and unbounded — entries are keyed by `src` and
never evicted. Fine for documents with a bounded image set; if you ever load
images unboundedly (an infinite gallery), this needs an eviction policy first.

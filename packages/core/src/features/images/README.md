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

## Note

The cache is process-global and unbounded — entries are keyed by `src` and
never evicted. Fine for documents with a bounded image set; if you ever load
images unboundedly (an infinite gallery), this needs an eviction policy first.

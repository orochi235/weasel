---
'@weasel-js/renderer': major
---

`@weasel-js/renderer/testing/glRecorder` exports `recordedPaintTextures(gl)` in place of `webglDevice`.

It answers a `PaintBindContext`'s `createTexture` and `deleteTexture` over a recorded context, as the renderer binds them, for a test driving a paint kind's `bind` without a renderer. `_setBatchCutsForTests(renderer, on)` joins `test-seams`.

```ts
// before
const gpu = webglDevice(rec.gl);
const ctx = { ...rest, createTexture: (w, h, data) => gpu.createTexture('rgba8', sampling, { width: w, height: h, data }), deleteTexture: (t) => gpu.deleteTexture(t) };
// after
const ctx = { ...rest, ...recordedPaintTextures(rec.gl) };
```

<!-- entry: breaking api -->

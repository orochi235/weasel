## Carried `.lbx` objects skip the auto-length bound every mapped object is held to
- where: packages/p-touch/src/lbx/writeLbx.ts:128-138 (collect)
- scenario: `writeLbx({ length: 100, autoLength: true, commands: [lbxObjectsCommand([barcode at x = 150])] })`. A rect, line or text at x = 150 fails `withinLength(o, end)` and goes to the rasterizer, which draws only `[0, length]`. The carried branch never calls `withinLength`, so the barcode is written as an object past the label's end. P-touch then grows the label to reach it, and the file's length no longer matches `length`, the background band (`backgroundFor(paper, page.length)`) or the images rasterized against `page.length`. The carried branch should hold its placed objects to `end` too, and skip them with a reason when they pass it.
- evidence: read
- severity: medium

## `rasterDpi` is never validated, so 0, a negative or NaN writes non-finite image positions into the file
- where: packages/p-touch/src/lbx/writeLbx.ts:201-207 (rasterObject), 219 (settle)
- scenario: `writeLbx(page, { rasterize, rasterDpi: 0 })` gives `scale = 0`. The rasterizer clamps the output to at least 1×1 px (`pixelRenderRect` uses `Math.max(1, round(...))`), so ink shows up at pixel (0, 0) and the image object gets `position.width = 1 / 0 = Infinity`. A negative dpi gives negative sizes, and NaN gives NaN. Object positions are filtered through `finiteObject`, but image objects are not, and `lbxConfig` rejects a bad `length` with a RangeError while letting a bad `rasterDpi` through.
- evidence: read
- severity: low

## Files read
packages/p-touch/src/index.ts
packages/p-touch/src/lbx/carried.ts
packages/p-touch/src/lbx/sceneLbx.ts
packages/p-touch/src/lbx/shapes.ts
packages/p-touch/src/lbx/style.ts
packages/p-touch/src/lbx/writeLbx.ts
packages/p-touch/src/pbt.fixture.ts
packages/p-touch/src/print.ts
packages/p-touch/src/render.ts
packages/p-touch/src/tape.ts

<!-- done: 2 findings, files read: 10 -->

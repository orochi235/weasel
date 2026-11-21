I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below.

# Audit round 63 — area `headless` (blind reviewer)

## `NodeRenderArgs` cannot name `camera`, `layers` or `pixelRatio`, though they cross to the page and work there
- where: packages/headless/src/protocol.ts:12 (SerializableRenderArgs), packages/headless/src/host.ts:28 (NodeRenderArgs)
- scenario: The doc says `SerializableRenderArgs` is "`renderSceneToPixels`'s arguments that survive JSON", minus only `drawOne`, `resolveImage`, `alphaFor`, `colorOverrides` and `trimOverrides`. But core's `RenderSceneToPixelsArgs` (packages/core/src/canvas/renderSceneToPixelsTypes.ts) also takes `camera` (a plain `View`), `layers` (`readonly string[]`) and `pixelRatio` (a number), all plain data. The interface leaves them out. So a TypeScript caller writing `host.render({ scene, sourceRect, scale, layers: ['scene:main'] })` or passing `camera` to capture what a view shows gets an excess-property error, even though `readPageRequest` would pass the field through and `pageRenderArgs` would hand it to `session.render`. They are also never validated in Node: `pixelRatio: NaN`, or a `layers` name the scene lacks, starts Chromium and fails in the page. The ruling at unruled.md:646 is that such fields are refused in Node before a browser starts.
- evidence: read (protocol.ts, host.ts, core renderSceneToPixelsTypes.ts and planPixelRender)
- severity: medium

## A raw snapshot's own data under a `coords` or `commands` key reaches the page as a Float32Array or Uint8Array
- where: packages/headless/src/protocol.ts:51 (sceneToWire)
- scenario: For an object without `toJSON`, `sceneToWire` runs `encodeSnapshot(decodeSnapshot(scene))`. `decodeSnapshot`'s `decodeWithin` turns any plain array of numbers under a key named `coords` or `commands`, at any depth, into `Float32Array` / `Uint8Array`, because that is how an old save stored a path (codec.ts:110). Take a raw `scene.toJSON()` snapshot whose node data is `{ coords: [12.345678, 40], commands: [300, 2] }`: the page gets `Float32Array [12.345678..., 40]`, with float32 precision, and `Uint8Array [44, 2]`, wrapped mod 256. The same scene passed live goes through `encodeSnapshot(toJSON())`, which wraps those arrays in `__raw` and keeps them. So the two input forms that `NodeRenderArgs.scene` documents as equivalent draw different data. Ruling unruled.md:291 covers only an already-tagged snapshot staying tagged, not consumer arrays becoming typed.
- evidence: read (protocol.ts, core/persistence/codec.ts)
- severity: medium

## A page whose replacement session never gets a WebGL2 context stays broken for the host's life
- where: packages/headless/src/page.ts:42 (lost / replaceIfLost)
- scenario: `lost()` reports a loss only when the canvas has a context and that context reports `isContextLost()`. After a loss, `replaceIfLost` opens a new session. If Chromium then refuses a new WebGL2 context on that page (it blocks WebGL after repeated context losses or GPU resets), the new session's `openCanvas` keeps a canvas with `gl` undefined. Every render after that throws "raster session: WebGL2 is unavailable". `canvas.getContext('webgl2')` returns null, so `lost()` is false, the session is never replaced, and the page never crashed or closed, so the host's `gone()` never reopens it. Every later render on that host fails.
- evidence: read (page.ts, core createRasterSession/prepareContext); Chromium's blocking behavior is inference
- severity: low

## `dispose()` can resolve while a dropped page's browser is still closing, and it never waits on that close
- where: packages/headless/src/host.ts:141 (drop), :153 (dispose)
- scenario: A render fails on a crashed page. `drop` sets `opening = null` and starts `void close(opened)`, which is `browser.close()` for a browser the host launched. A `dispose()` right after sees `opening === null` and returns at once, while that Chromium is still shutting down. If the close hangs or fails, the error is swallowed and nothing retries it. A caller that awaits `dispose()` and then expects every browser process gone sees one still alive, although `dispose`'s doc says it closes the browser the host launched.
- evidence: read
- severity: low

## `MAX_RESULT_BYTES` bounds the base64 string itself, but the CDP message carrying it is longer
- where: packages/headless/src/protocol.ts:61 (MAX_RESULT_BYTES)
- scenario: At `MAX_RESULT_BYTES`, the base64 is exactly 4 × 134217722 = 2^29 − 24 characters, which is V8's string cap. The value returns from `page.evaluate` inside a protocol message (the JSON envelope, id and result wrapper), which Node reads as one string before parsing. So an RGBA render within roughly 100 bytes under the limit passes `checkResultBytes` and still fails, with Node's "Cannot create a string longer than…" instead of the named limit.
- evidence: read (protocol.ts); Playwright's transport reading the message as one string is inference
- severity: low

## Files read
packages/headless/src/defaultPage.ts
packages/headless/src/host.ts
packages/headless/src/index.ts
packages/headless/src/page.ts
packages/headless/src/pageLoad.ts
packages/headless/src/protocol.ts
packages/headless/src/testing/compareRaster.ts
packages/headless/src/testing/fixtureScene.ts
packages/headless/src/testing/protocol.ts
packages/headless/src/testing/registeredPage.ts
packages/headless/src/testing/registeredScene.ts

<!-- done: 5 findings, files read: 11 -->
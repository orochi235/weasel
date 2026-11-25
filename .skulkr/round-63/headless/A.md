I couldn't write `.skulkr/out/findings.md` because the write was denied, so the full findings document is below.

Note on the tree: the brief names commit 1b4edb3a93db1759496d564da57eb13020b3d7d2, but that object isn't in this repo (`git cat-file` reports a bad object). I read the checkout as it stands, at HEAD 6f634fabe1, which has no local changes under `packages/headless`. Line numbers refer to that tree.

## The host refuses a page script that calls `serveHeadlessPage` asynchronously, as one that waits for its fonts to load before serving
- where: packages/headless/src/host.ts:77-79 (open)
- scenario: `pageScript` is a classic script that does `loadFonts().then(() => serveHeadlessPage({ scene }))`. That matches how `serveHeadlessPage`'s doc describes it: "the call a page script makes once, after registering its fonts". A classic script can't use top-level `await`, so this is the only way to serve after an async registration. `addScriptTag({ content })` resolves as soon as the inline script's synchronous part has run, because Playwright's `addScriptContent` appends the element and returns. The `Object.hasOwn(globalThis, PAGE_GLOBAL)` check then runs before the promise settles. `open` throws "the page script ran but never called `serveHeadlessPage`" and closes the page, so every render fails. The host should wait for the global with a time limit, or state in its contract that the call must be synchronous.
- evidence: read (host.ts; playwright-core 1.65.1 `lib/coreBundle.js:25545-25555`, `addScriptContent`)
- severity: medium

## A page script that throws loses its error: the host reports "never called `serveHeadlessPage`" in its place
- where: packages/headless/src/host.ts:77-79 (open)
- scenario: a custom `pageScript` throws while it runs. The cause might be:
  - a `registerFont` or paint-kind registration that throws;
  - a bundling error;
  - `serveHeadlessPage` itself throwing "this page already serves renders" because the bundle calls it twice.

  An inline script's runtime exception goes to `window.onerror`, not to the script element's `onerror`. Playwright's `addScriptContent` never sees it, so `addScriptTag` resolves. `open` then throws the generic "never called `serveHeadlessPage`", which names a different cause and drops the real exception, and nothing listens on `page.on('pageerror')`. The host should collect page errors while the script runs and use the first one as the thrown error or its `cause`.
- evidence: read (host.ts; playwright-core 1.65.1 `lib/coreBundle.js:25545-25555`)
- severity: low

## `MAX_RESULT_BYTES` bounds only the base64 string, not the CDP message carrying it; a result just under the limit breaks Playwright's pipe
- where: packages/headless/src/protocol.ts:61 (MAX_RESULT_BYTES), checked at protocol.ts:113-116 and page.ts:18
- scenario: an RGBA render with W×H×4 just under `MAX_RESULT_BYTES` (402 653 166 bytes, so W×H between about 100 663 264 and 100 663 291 pixels) passes both checks. Its base64 is then within about 100 characters of V8's 2^29 − 24 string cap. The result reaches Node inside a CDP response, which adds the id, the session id and Playwright's serialization wrapper around that string. Playwright's `PipeTransport._dispatch` runs `Buffer.concat(this._pendingBuffers).toString()` on the whole message. That throws `ERR_STRING_TOO_LONG` inside the pipe's data handler, before `_pendingBuffers` is reset. The render then either never settles or the error escapes as uncaught, instead of the named "past the … one result can carry" refusal. The bound needs room for the envelope. The window is narrow, but the failure is a hang or a process-level throw.
- evidence: read (protocol.ts; playwright-core 1.65.1 `lib/coreBundle.js:41248-41272`); the envelope size is inference
- severity: low

## `dispose()` resolves before the browser of a crashed page has finished closing
- where: packages/headless/src/host.ts:141-145 (drop), 153-161 (dispose)
- scenario: the host launched its own Chromium. A render's page crashes, so `drop` sets `opening = null` and starts `void close(opened)` without awaiting it. The caller then awaits `host.dispose()`. It sees `opening === null` and returns at once while `browser.close()` is still running. The contract says dispose closes the browser when the host launched it, but that hasn't happened when the promise resolves. A test runner's leak check, or a caller that exits right after dispose, finds a live Chromium child process. The same happens when a render finds the page gone between renders (host.ts:106-108). `dispose` should await the closes it started in the background.
- evidence: read
- severity: low

## The `difference` test helper compares rasters by byte length only, so a transposed or reshaped result passes as identical
- where: packages/headless/src/testing/compareRaster.ts:14-17 (difference)
- scenario: `difference(a: Uint8Array, b: RasterImage)` takes the Node render's bytes without their dimensions, and both browser tests pass `nodePixels(...).data` (headless.browser.test.ts:39, registered.browser.test.ts:21). Suppose the Node render comes back 8 × 2 and the in-page render 4 × 4, or a page bug swaps width and height. The byte lengths match, so the comparison runs pixel by pixel and can report `{ pixels: 0, maxStep: 0 }` for a solid fill. It should refuse the pair, as it already does for a length mismatch. The fix is to pass `a`'s width and height, which `nodePixels` already returns.
- evidence: read
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
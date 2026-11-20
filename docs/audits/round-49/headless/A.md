## A lost WebGL context leaves the host failing every render for good
- where: packages/headless/src/page.ts:35 (serveHeadlessPage) and packages/headless/src/host.ts:118 (createNodeRasterHost → call)
- scenario: the page's one `createRasterSession()` loses its WebGL2 context (GPU reset, the GPU process restarting under memory pressure, a driver timeout on a big render). The session's own canvas has no `webglcontextlost` handler, so the context stays lost, and `prepareContext` throws "the WebGL2 context is lost — dispose this session and open another" on every later render. The page never replaces its session, and the host only drops a page that `crashed`, closed, or lost its browser, so a lost context is none of these. Every later `render`/`renderPng` on that host rejects until the caller disposes it. It should open a new session (in the page) or a new page (in the host) after a loss, the way it recovers from a crash.
- evidence: read (page.ts `session` is created once; host.ts's catch checks only `crashed`, `isClosed()`, `isConnected()`; core `renderSceneToPixels.ts` `prepareContext` throws on `isLost(gl)`)
- severity: medium

## A page that crashed between renders fails the next render although the host already knows
- where: packages/headless/src/host.ts:113-125 (createNodeRasterHost → call)
- scenario: the page crashes while idle (the `crash` listener sets `opened.crashed = true`). The next `render` still evaluates on the crashed page, rejects with Playwright's crash error, and only then resets `opening`. So one render fails that the host could have served by reopening, since it checked `crashed` only in the catch and not before evaluating. Expected: an already-crashed page is dropped and reopened before the render goes out.
- evidence: read
- severity: low

## A failing cleanup in `open` hides the error that caused it
- where: packages/headless/src/host.ts:84-88 (open)
- scenario: `newContext`, `newPage`, `addScriptTag` or the ready check throws, and then `browser.close()` (a launched browser) or `context.close()` (a caller's browser) also rejects, for example because the browser already went away. The cleanup's rejection replaces the original error, so the caller sees "browser has been closed" or similar instead of the real cause (for example "the page script ran but never called `serveHeadlessPage`"). The cleanup should be awaited with its failure swallowed, and the original error rethrown.
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

<!-- done: 3 findings, files read: 11 -->

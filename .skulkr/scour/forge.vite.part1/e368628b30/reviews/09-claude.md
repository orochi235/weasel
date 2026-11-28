# forge.vite.part1 — blind review findings

## A redirected allowlisted request is fulfilled at its original URL, so relative references in the body resolve against the pre-redirect location
- where: packages/forge/src/vite/capture/browser.ts:78 (passThrough)
- scenario: a story loads `https://unpkg.com/some-pkg` (allowlisted), which 302s to `https://unpkg.com/some-pkg@1.2.3/dist/index.js`. passThrough follows the hop in Node and calls `route.fulfill` with the final body, but the browser still believes the response came from `https://unpkg.com/some-pkg`. The module's `import './chunk.js'` then resolves to `https://unpkg.com/chunk.js` instead of `…/some-pkg@1.2.3/dist/chunk.js`. A stylesheet's relative `url(font.woff2)` behind a CDN redirect breaks the same way, and the capture renders without that dependency or with a missing font. The screen, which follows the redirect natively, renders correctly, so the capture differs from what the screen shows.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/capture/browser.ts
- size: function
- cause: redirect chain collapsed into one response at the original URL
- confidence: likely

## The capture and issues endpoints refuse a page served at vite's `server.origin` (or `hmr.host`) that vite's own host check accepts
- where: packages/forge/src/vite/capture/endpoint.ts:113 (ownHost), packages/forge/src/vite/capture/endpoint.ts:77 (ownOrigin)
- scenario: a dev server sits behind a reverse proxy with `server.origin: 'http://dev.corp.test'` (or `server.hmr.host` set to it). Vite adds `server.origin`'s hostname and `hmr.host` to the hosts it allows (`getAdditionalAllowedHosts`), so the workshop loads at `http://dev.corp.test`. ownHost knows only IPs, localhost, `server.host`, `allowedHosts` and printed URLs, so `GET __forge/issues` answers 403. ownOrigin knows only the socket address, a loopback on the same port, and printed URLs, so every capture POST from that page (Origin `http://dev.corp.test`) also answers 403. Pixels and issues are unusable behind the proxy, even though ownHost's doc says it asks what vite's host check asks.
- evidence: read (vite's additional allowed hosts are from memory of vite's source, not opened here)
- severity: low
- fix: packages/forge/src/vite/capture/endpoint.ts
- size: function
- cause: host/origin allowlist diverges from vite's
- confidence: likely

## A `deps.js` build that overlaps a post-edit rebuild can overwrite the fresh graph with a stale one
- where: packages/forge/src/vite/depsFeed.ts:92 (module)
- scenario: one page has already loaded `deps.js`, so `depsSent` is non-null. A second tab, or a reload, requests `deps.js`, and `module()` starts building from files it reads before an edit. During that build the file is edited. `redeps` sees `depsSent !== null` and runs `rebuild` straight away, alongside the build that is still going; `serving`/`editedWhileServing` only handle the `depsSent === null` case. The rebuild finishes first, sets `depsSent` to the new graph G2 and pushes `forge:deps`. Then `module()` finishes with the pre-edit graph G1, sets `depsSent = G1` and serves G1. The loading page receives the G2 push, then `setDependencies` with G1 from the import, so it shows the stale graph. `depsSent` stays G1 until another edit happens to produce a different JSON.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: edit-during-serve handled only before the first send
- confidence: likely

## Files read
packages/forge/src/vite/apiTable.ts
packages/forge/src/vite/ast.ts
packages/forge/src/vite/autoTitle.ts
packages/forge/src/vite/bindings.ts
packages/forge/src/vite/build.ts
packages/forge/src/vite/capture/browser.ts
packages/forge/src/vite/capture/cache.ts
packages/forge/src/vite/capture/endpoint.ts
packages/forge/src/vite/capture/entries.ts
packages/forge/src/vite/capture/payload.ts
packages/forge/src/vite/componentGraph.ts
packages/forge/src/vite/componentOf.ts
packages/forge/src/vite/componentReach.ts
packages/forge/src/vite/depsFeed.ts
packages/forge/src/vite/entries.ts
packages/forge/src/vite/folderTitles.ts
packages/forge/src/vite/foreignStories.ts
packages/forge/src/vite/forgeTest.ts
packages/forge/src/vite/freeNames.ts
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts

<!-- done: 3 findings, files read: 27 -->

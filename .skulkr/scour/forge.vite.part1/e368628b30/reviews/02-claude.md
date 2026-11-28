## An edit landing while `deps.js` is being served, after a graph was already sent, can leave the page and `depsSent` on the pre-edit graph
- where: packages/forge/src/vite/depsFeed.ts:96 (createDepsFeed → module / redeps)
- scenario: a graph has been sent once (`depsSent !== null`); a page reloads (or a second tab opens) and requests `deps.js`, so `module()` starts building and reads file F. F is edited: the plugin invalidates F and calls `redeps`, which, since `depsSent !== null`, starts `rebuild` concurrently instead of recording `editedWhileServing`. The rebuild reads the new F, sets `depsSent = G1` and pushes `forge:deps` G1. Then `module()` finishes with the graph it built from the old F, overwrites `depsSent = G0` and serves G0; the page's `import('virtual:forge/deps.js').then(setDependencies)` lands after the push and replaces G1 with G0. The page shows the stale graph, and because `depsSent` now equals G0, nothing re-pushes until a later edit happens to change the graph again. Should: an edit during `module()` always schedules a rebuild after it is served (the `editedWhileServing` path), whatever `depsSent` holds, or `module()` should not overwrite a `depsSent` written by a rebuild that started after it.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: edit-while-serving recorded only when nothing was sent yet
- confidence: likely

## An allowlisted response with several `Set-Cookie` headers reaches the capture page with only the last
- where: packages/forge/src/vite/capture/browser.ts:97 (passThrough)
- scenario: a story loads from an origin in `allowOrigins`, and that server answers with two `Set-Cookie` headers. Node's `Headers` iterator yields each `set-cookie` as its own entry, and `Object.fromEntries` keeps only the last, so the page receives one cookie where the browser would have stored both. A story that depends on the first cookie (a session plus a CSRF token, say) renders differently in the capture than on screen. Should: build the fulfilled headers so repeated `set-cookie` values all go through (for example `response.headers.getSetCookie()` joined the way Playwright's `headers` accepts, or `headersArray`).
- evidence: read
- severity: low
- size: line
- cause: multi-valued header collapsed by Object.fromEntries
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

<!-- done: 2 findings, files read: 27 -->

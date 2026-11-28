## An edit landing while `deps.js` is being built, once a graph was already sent, can leave the page holding a pre-edit graph
- where: packages/forge/src/vite/depsFeed.ts:106 (redeps), with module at :88
- scenario: A page has loaded `deps.js` once, so `depsSent` is not null. A later request (a reload after `invalidateVirtual`, a second tab) starts `module()`, which reads files into the graph builder's cache. A file is edited mid-build: `redeps` sees `depsSent !== null` and starts `rebuild` concurrently, instead of recording `editedWhileServing`. If `rebuild` finishes first, it pushes the new graph G2 and sets `depsSent = G2`. Then `module()` finishes with G1, built from the file as read before the edit, sets `depsSent = G1`, and serves G1. The page that requested it calls `setDependencies(G1)` after the push, or after missing it, and keeps the stale graph until another edit. The `serving` branch exists to queue a rebuild after `module` for exactly this case, but it is only reached when `depsSent === null`.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: `serving` checked only when nothing was sent
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

<!-- done: 1 findings, files read: 27 -->

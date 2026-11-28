## An edit landing while a later `deps.js` request builds can leave the page with the pre-edit graph and nothing pushing the new one
- where: packages/forge/src/vite/depsFeed.ts:105 (redeps) and :91 (module)
- scenario: a page has already loaded `deps.js` once, so `depsSent` is non-null. The page reloads (or `deps.js` is invalidated and requested again), and `module()` starts a build. An edit lands mid-build: `redeps` sees `depsSent !== null` and starts `rebuild` right away, concurrent with the running `module()` build (the `serving`/`editedWhileServing` path that defers the rebuild until after serving is only taken when `depsSent === null`). `module()`'s build has already read the edited file's old contents, so it produces the old graph G1. If `rebuild` finishes first, it pushes the new graph G2 to the old socket clients and sets `depsSent = G2`. Then `module()` finishes, overwrites `depsSent = G1`, and serves G1 to the freshly loading page. Nothing rebuilds again, so the page shows a stale component graph until the next edit. What should happen: an edit during any `module()` build is replayed after it, as it already is for the first build.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: deferred-rebuild path gated on `depsSent === null` rather than on `serving`
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

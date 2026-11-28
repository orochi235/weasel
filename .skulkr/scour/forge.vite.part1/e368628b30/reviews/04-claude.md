## An edit landing while `module()` builds, once any graph has been sent, races the rebuild and can leave the page on the pre-edit graph
- where: packages/forge/src/vite/depsFeed.ts:105 (redeps)
- scenario: a page has been served deps.js once (`depsSent !== null`), then reloads, or `invalidateVirtual` makes it import deps.js again, so `module()` starts building. An edit lands mid-build: `redeps` sees `depsSent !== null` and calls `rebuild` at once instead of queuing it behind `serving`. The rebuild finishes first and pushes the post-edit graph over `forge:deps`. Then `module()` finishes with a graph read from pre-edit files, sets `depsSent` to it and returns it. The page's `import('virtual:forge/deps.js').then(setDependencies)` (entries.ts) resolves after the push and overwrites the fresh graph with the stale one, which stays until the next edit. It should either serve the post-edit graph or rebuild after the serve, as it already does when `depsSent === null`.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/depsFeed.ts
- size: line
- cause: serving guard only consulted when nothing was sent yet
- confidence: likely

## A capture is cached under a key that leaves out the origins it was allowed to load
- where: packages/forge/src/vite/capture/endpoint.ts:203 (serveCapture capture)
- scenario: `allowOrigins` is a thunk "read at each capture", so it can change while the server runs. A payload captured while a font or image origin was not allowed renders without it, and its PNG is cached under `keyOf(payload)`. After the allowlist changes, the same payload is served from the cache with the blocked resource still missing until some client module edit calls `revise()`. The key should include `allowOrigins()`, or a change to the allowlist should clear the cache.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/capture/endpoint.ts
- size: line
- cause: cache key omits a render input
- confidence: likely

## An unscoped package's release pattern also matches a scoped package's tags of the same base name
- where: packages/forge/src/vite/history.ts:136 (createHistoryReader load)
- scenario: for a file in package `foo`, the refs are `--refs=foo@[0-9]*`. `git name-rev --refs` matches a pattern against every suffix of the refname after a `/`, so the tag `refs/tags/@scope/foo@2.0.0` matches too, through its suffix `foo@2.0.0`. In a repo with both `foo` and `@scope/foo`, `introduced` and `modifiedIn` for `foo`'s files can name `@scope/foo`'s release. The pattern should be anchored, for example `refs/tags/foo@[0-9]*`, and likewise for `v[0-9]*` and `[0-9]*`.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/history.ts
- size: line
- cause: unanchored name-rev ref pattern
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

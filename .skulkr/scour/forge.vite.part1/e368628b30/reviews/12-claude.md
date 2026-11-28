## deps.js served mid-edit can overwrite the pushed graph with a stale one
- where: packages/forge/src/vite/depsFeed.ts:105 (redeps / module)
- scenario: a page has already been served deps.js (`depsSent !== null`). A second page load starts `module()`; its build reads a component file. The file is then edited: the plugin invalidates it and calls `redeps`, which, since `depsSent !== null`, starts `rebuild` at once, beside the running `module()` build rather than after it. `rebuild` finishes first, sets `depsSent` to the new graph and pushes it. `module()` then finishes with the graph from before the edit, overwrites `depsSent` with that stale JSON and serves it, so the page that just loaded calls `setDependencies(stale)`. Nothing rebuilds afterward, because `depsSent` now matches what was served. The page shows the old graph until the next edit. What should happen: an edit that lands while `module()` is building is deferred to a rebuild after it, as already happens when `depsSent === null`.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: editedWhileServing only consulted when nothing was sent yet
- confidence: likely

## Capture contexts keep each story's storage, so a capture depends on the captures before it
- where: packages/forge/src/vite/capture/browser.ts:150 (contextCache / contextFor)
- scenario: every capture with the same dpr and protocol opens its page in one long-lived BrowserContext. Only the page is closed after a capture, so localStorage, sessionStorage, IndexedDB and cookies on the dev server's origin carry over into the next capture. Say story A writes a persisted preference (a theme, a panel size, labkit or forge state kept in localStorage). A later capture of story B in the same context renders with A's state, and a recapture of the same payload can come out differently depending on what ran in between. The endpoint caches by payload alone, so whichever variant came first is what gets kept. What should happen: each capture starts from clean storage (a fresh context per capture, or clear the context's storage and cookies between captures).
- evidence: read
- severity: medium
- size: function
- cause: context reused across captures without clearing storage
- confidence: likely

## A reassignment written through a TS cast is not seen, so a `let` reads as its first initializer
- where: packages/forge/src/vite/ast.ts:118 (assignedNames)
- scenario: given `let meta = { title: 'A' }; (meta as Meta) = { title: 'B' }; export default meta;` or `meta! = …`, `patternNames(n.left)` returns [] for a TSAsExpression, TSSatisfiesExpression, TSNonNullExpression or ParenthesizedExpression left side. So `meta` is not in `reassigned`, `bindingsOf` keeps `{ title: 'A' }` as its value, and the indexer titles the file 'A' where at runtime it is 'B'. What should happen: unwrap the cast or parentheses before reading the names it assigns.
- evidence: read
- severity: low
- size: line
- cause: LVal casts not unwrapped
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

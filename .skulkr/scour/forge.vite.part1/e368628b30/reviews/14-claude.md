## A page that loads `deps.js` while an edit lands can keep a stale component graph until the next edit
- where: packages/forge/src/vite/depsFeed.ts:96 (createDepsFeed — module / redeps)
- scenario: a page has loaded once, so `depsSent` is non-null. The page reloads, and `module()` starts building the graph. An edit lands mid-build, and `redeps` sees `depsSent !== null`, so it starts `rebuild` right away and does not set `editedWhileServing`. If `rebuild` finishes first, it sets `depsSent` to the new graph and pushes `forge:deps`, possibly before the reloading page is listening. Then `module()` finishes and serves the graph it built from files read before the edit, overwriting `depsSent` with that stale JSON. The page holds the old graph, and nothing pushes the new one until another edit changes the graph again. It should do what the `depsSent === null` path does: rebuild after the serve whenever an edit landed during it.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: edit-during-serve is only deferred when nothing was sent before
- confidence: likely

## The auto-title port drops an `Index`/`INDEX` file name that Storybook keeps
- where: packages/forge/src/vite/autoTitle.ts:25 (titleParts)
- scenario: given `src/components/Index.stories.tsx`, forge's `/^index$/i` treats `Index` as an index file and titles the story `components`. As I recall it, Storybook's `sanitize` tests `/^index$/` with no `i` flag and titles it `components/Index`. The file says it must agree with Storybook or ids and links diverge, so the story's id and link would differ between the two.
- evidence: read (forge side); Storybook's regex is from memory, not checked against 10.4.0
- severity: low
- size: line
- cause: case-insensitive flag not in upstream
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

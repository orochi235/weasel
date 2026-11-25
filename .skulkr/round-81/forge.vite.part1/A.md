# Audit round 81, forge.vite.part1: findings

## Inherited-prop rows from a skipped file outside node_modules are named and grouped by the file's basename, not its package
- where: packages/forge/src/vite/apiTable.ts:118 (packageOf), used at apiTable.ts:45-48 and inheritedRows
- scenario: `propControls.skip` (propTypes.ts:52, `skipped = platform(file) || skip?.(file)`) skips a workspace package whose files resolve to source, e.g. `/repo/packages/ui/src/types.ts`. `packageOf` finds no `node_modules` segment and returns `types.ts`. The row then reads `from: 'types.ts'` when the type is anonymous, or `ButtonProps (types.ts)` when disambiguated. Two skipped packages that each have a `types.ts` declaring a same-named container are merged under one key (`types.ts\0ButtonProps`), so their counts are added together and shown as one row. The row should name the package, which means reading the nearest `package.json` for files outside `node_modules` (history.ts already has a `packageOf` that does this).
- evidence: read (apiTable.ts and propTypes.ts:51-52)
- severity: low

## The capture guard does not see redirects: an allowlisted http origin, or the server's own origin, can redirect the page anywhere
- where: packages/forge/src/vite/capture/browser.ts:96-101 (guard), plus the passThrough doc comment at :63-65
- scenario: Playwright calls a `page.route` handler only for the first URL of a redirect chain; per its docs, "the handler will only be called for the first url if the response is a redirect". On an http dev server, a request to an allowlisted origin goes through `route.continue()`. If that origin answers 302 to `http://anything/`, Chromium follows the redirect and the guard never sees the target, which breaks the "reach nothing but … `allow`" promise. The same holds for an own-origin URL that redirects. The comment on `passThrough` assumes the redirect target "meets the route guard on its own origin", which Playwright's documented behavior contradicts for `continue()`. Whether a fulfilled 3xx re-enters the route was not verified. Fix: fulfill every allowlisted request from Node with `redirect: 'manual'`, not only on https, and check the `Location` origin before returning it.
- evidence: read; Playwright's redirect behavior is quoted from memory of its docs, not run
- severity: low

## In middleware mode with no HMR port set, `hmrSocketOf` names the page's port, so the guard closes vite's real HMR socket (24678) and the page reloads mid-capture
- where: packages/forge/src/vite/capture/endpoint.ts:56-63 (hmrSocketOf)
- scenario: Under `server.middlewareMode` with `hmr` left unset (`hmr: true` or `{}`), vite's client injection falls back to port 24678 (`port ||= 24678` when middleware mode has no HMR server given). `hmrSocketOf` falls back to `page.port` instead. `guard` then closes the client's socket, which is the case its own comment says makes the client reload the page mid-capture, so the capture fails or shows a half-loaded page. It should follow vite's fallback.
- evidence: read; vite's fallback is from memory of `clientInjections`, not run
- severity: low

## `reset()` does not stop a rebuild already running, which then marks the new root's graph as sent and pushes the old root's graph
- where: packages/forge/src/vite/depsFeed.ts:62-70 and 85-89 (rebuild, reset)
- scenario: An edit starts `rebuild`, and `reset()` is called while `graphOf` is awaiting the old builder or history reader. When the rebuild finishes, it sets `depsSent` to the old root's graph, invalidates `deps.js` and sends `forge:deps` with that graph. After reset, `depsSent` should stay null until a page asks again. Instead, later edits keep rebuilding even though no page has requested the graph, and an open page receives a graph from the previous root.
- evidence: read
- severity: low

## A getter or method in an object literal does not override an earlier property of the same key in `prop`
- where: packages/forge/src/vite/ast.ts:268-275 (lookup)
- scenario: For `{ title: 'A', get title() { return 'B' } }`, or a story spec `{ name: 'x', name() {} }`, `lookup` walks properties from last to first. It skips the `ObjectMethod`, because `p.type !== 'ObjectProperty'`, and returns the earlier `'A'`, so the index titles or names the story with a value that runtime never uses. A non-computed `ObjectMethod` whose key matches should end the lookup as unreadable (ABSENT), the same way an unreadable value is treated.
- evidence: read
- severity: low

## `git name-rev` gets every component's commit SHAs as arguments, which can exceed the command-line limit in a large project
- where: packages/forge/src/vite/history.ts:124-126 (createHistoryReader → load)
- scenario: Each package group passes two 40-character SHAs per component file on one `execFile` command line. On Windows, where a command line is capped at 32 767 characters, roughly 400 components in one package make the spawn fail with ENAMETOOLONG. `read` catches that and returns `{}`, so every component silently loses its history. `name-rev --stdin`, or batching the SHAs, avoids the limit.
- evidence: read (the Windows limit is from platform knowledge)
- severity: low

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

<!-- done: 6 findings, files read: 26 -->

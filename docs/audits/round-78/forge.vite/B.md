# Audit round 78, area forge.vite: findings

## A native story file's `export { LocalClass }` (or an enum or a destructured const) is indexed as a story
- where: packages/forge/src/vite/ast.ts:29 (bindingsOf), packages/forge/src/vite/indexFile.ts:127 (indexProgram)
- scenario: a native file does `class Fixture {}` (or `enum Mode {}`, or `const { a } = obj`) and then `export { Fixture }`. `bindingsOf` records only variable declarators with an Identifier id and function declarations, so `Fixture` has no binding. `indexProgram` falls back to the `spec.local` Identifier. `mayBeStory(Identifier)` finds no binding and asks `foreign.value('Fixture')`. `foreignStories`' `asking` gets `mod.imports.get('Fixture')` as undefined, so the answer is undefined, which `?? true` turns into "may be a story". The index then lists a `Fixture` story that the loader never takes, so it shows as a broken entry. `moduleInfo` does record class declarations, which means the two parsers disagree about what the file declares. It should be left out the same way an `export class Fixture {}` is.
- evidence: read
- severity: medium

## A story file edited into a parse error keeps its old entries, though a file that fails at startup has none
- where: packages/forge/src/vite/storyIndex.ts:128 (update)
- scenario: a story file parses at startup and is then saved with a syntax error. `read` throws, the code logs it, and `current.set(file, [])` runs only for `add`. On a `change` the map keeps the last good entries and `update` returns null. The tree and `importers.js` go on listing those stories, and their module now fails to import. The same broken file at startup (`files()`) indexes to `[]`, the outcome that `StoryIndex.files` documents ("a file that failed to parse has none"). One question gets two answers depending on when the failure happens.
- evidence: read
- severity: low

## Deleting a file leaves other importers' cached resolutions pointing at it, so the component graph loses an edge another file now answers
- where: packages/forge/src/vite/componentGraph.ts:82 (invalidate), packages/forge/src/vite/plugin.ts (watchSources)
- scenario: `./widget` resolves to `widget.ts`, and `widget/index.ts` also exists. Deleting `widget.ts` fires `unlink`. `invalidate` drops only the deleted file's own module and its own resolutions. Every other importer's cached `./widget → widget.ts` promise survives (it is cleared only by `reset()`, which runs only on `add`). The next build reads the missing file as null, and the graph drops the component edge that `widget/index.ts` now provides. The graph stays wrong until some unrelated file is added or the server restarts. An unlink can redirect a resolution just as an add can, so it should `reset()` too.
- evidence: read
- severity: low

## A capture requested over a link-local IPv6 address builds a page URL that WHATWG URL rejects
- where: packages/forge/src/vite/capture/endpoint.ts:33 (urlHost, used by socketOrigin)
- scenario: the dev server binds `::`, and a request arrives on `fe80::1%en0`. `urlHost` writes `[fe80::1%25en0]` (RFC 6874), but the WHATWG URL parser used by Node's `URL` and by Chromium accepts no zone id in an IPv6 host. `guard`'s `new URL(url)` throws, the capture answers 500, and `ownOrigin`'s socket comparison can never match either. The escape produces a host that nothing downstream can parse. The capture should use a loopback or the printed URL instead.
- evidence: read
- severity: low

## With `watchProbe()` beside `forge()`, the server probes twice and logs the silent-watcher warning twice
- where: packages/forge/src/vite/plugin.ts:71 (watchSources), packages/forge/src/vite/watchProbe.ts:128 (watchProbe)
- scenario: forge calls `warnWhenWatchIsSilent` itself, and the exported `watchProbe()` plugin calls it again. `watchRecovery` deduplicates by name ("a server with two copies runs only the first"), but this pair has no such guard. A project that adds `watchProbe()` to the same config writes two temp-dir probes and, on a silent watcher, gets the same multi-line warning twice. The warning goes through `logger.warn` and not `warnOnce`.
- evidence: read
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
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/plugin.ts
packages/forge/src/vite/propControls.ts
packages/forge/src/vite/propTypes.ts
packages/forge/src/vite/servePages.ts
packages/forge/src/vite/shellTitle.ts
packages/forge/src/vite/storyGlob.ts
packages/forge/src/vite/storyIndex.ts
packages/forge/src/vite/storybookShims.ts
packages/forge/src/vite/titleReport.ts
packages/forge/src/vite/trace.ts
packages/forge/src/vite/typeDefs.ts
packages/forge/src/vite/typedoc/index.ts
packages/forge/src/vite/typedoc/json.ts
packages/forge/src/vite/typedoc/print.ts
packages/forge/src/vite/virtualModules.ts
packages/forge/src/vite/warnOnce.ts
packages/forge/src/vite/watchProbe.ts
packages/forge/src/vite/watchRecovery.ts
packages/forge/src/vite/watchSettle.ts
packages/forge/src/vite/wrappers.ts

<!-- done: 5 findings, files read: 50 -->

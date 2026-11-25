# Audit round 77 — forge.vite — blind reviewer findings

## A native story built by a default-exported helper is dropped from the index
- where: packages/forge/src/vite/ast.ts:13 (bindingsOf), reached from packages/forge/src/vite/foreignStories.ts:64 (declared)
- scenario: `helpers.ts` has `export default function variant(args) { return story({ args }); }` (or `export default (args) => story(...)`); a native story file does `import variant from './helpers'; export const Big = variant({ size: 'l' });`. `trace.declaring` follows `default` to `helpers.ts#variant` (moduleInfo records named default functions, and `*default*` for anonymous ones), but `declared` looks the local up in `scan(...).bindings`, and `bindingsOf` only walks `ExportNamedDeclaration`s and plain statements, never `ExportDefaultDeclaration`. The lookup misses, `declared` answers undefined, `foreign.call('variant')` stays unknown, and `mayBeStory` turns an unknown call into `false` (nativeExports.ts:101), so `Big` disappears from the index. The same helper exported by name is followed correctly.
- evidence: read
- severity: medium

## A call to an import nothing could decide is taken for "not a story", contrary to mayBeStory's own rule
- where: packages/forge/src/vite/nativeExports.ts:101 (mayBeStory, CallExpression)
- scenario: the doc comment says "What cannot be read stays in: an import nothing resolved". The Identifier branch keeps that rule (`scope.foreign?.value(name) ?? true`), but the CallExpression branch answers `scope.foreign?.call(callee.name) ?? false`. So when the helper's module fails to resolve, fails to parse, or is cut off by `MAX_DEPTH`, `export const A = makeStory()` in a native file is filtered out silently, while `export const A = importedStory` with the same unresolvable import stays in. The same happens on every call to `indexStory` without `resolved` (indexStory.ts:24: `foreign` undefined), so each such story is missing until settle succeeds.
- evidence: read
- severity: medium

## importers.js and deps.js are served from the index before the wrapper settle pass has run
- where: packages/forge/src/vite/plugin.ts:177 (load)
- scenario: only `index.js` awaits `stories.settleAll`. The shell entry imports `index.js` and `importers.js` statically, so the browser requests both at once, and `importers.js` (and `deps.js` via `index()`) can load from `files()` as `indexStory` read it without resolutions. A native file whose every story is made by an imported helper has no entries before settle (the unknown-call rule above), so it is left out of `importers.js`. Settle then gives it entries in `index.js`, and nothing invalidates the already-served `importers.js`: `settle` updates the map but pushes nothing. The tree lists stories whose module the page cannot import until some later edit triggers `reindex`.
- evidence: read
- severity: low

## CSF2 assignments are lost when a story is exported under another name
- where: packages/forge/src/vite/indexFile.ts:146 (indexProgram, `assigned.get(name)`)
- scenario: `const Base = {...}; Base.storyName = 'Nice'; export { Base as Primary };`. `assignedProps` keys assignments by the binding they are set on (`Base`), but the lookup uses the exported name (`Primary`), so `storyName`, `parameters.forge.isolate`, `tags` and the rest set by assignment are ignored. The index then names the story "Primary", while the loader (which reads the runtime object) names it "Nice". The same applies to `isolate` set by assignment, which then decides the document wrongly.
- evidence: read
- severity: low

## A full capture queue is answered as "capture unavailable"
- where: packages/forge/src/vite/capture/endpoint.ts:161 (capture)
- scenario: a burst of more than `QUEUE_CAP` captures (a comparison grid, say) makes `capture()` reject with `QUEUE_FULL`. The endpoint answers 503 `{ available: false, reason: QUEUE_FULL }`, the same shape it uses for a missing Playwright. The shell's client (shell/loupe/captureClient.ts:64) sets the lens status to that reason on any 503, so a transient backlog reads as Pixels being unavailable until a later capture succeeds or a poll resets it. The answer should be a retryable busy, not unavailability.
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

# Audit round 76 — forge.vite — findings

## foreignStories deadlocks on mutually recursive imported functions
- where: packages/forge/src/vite/foreignStories.ts:56 (exported / declared / asking)
- scenario: story file `export const S = f();` with `f` imported from `a.ts`: `import { g } from './b'; export function f() { return g(); }`, and `b.ts`: `import { f } from './a'; import { story } from '@weasel-js/forge'; export function g() { return x ? f() : story({…}); }`. Reading `a#f:true` stores a pending promise in `answers`, then asks about `g`; reading `b#g` asks about `f` (still fresh in its own `settled` pass), and `exported` returns the pending `a#f:true` promise, which is itself waiting on `b#g`. Neither settles. The comment says the cycle "meets a pending answer and not a second walk", but awaiting that pending answer from inside the walk that produces it never resolves. `createWrapperResolver` hangs, so `storyIndex.settle` hangs, `settleAll` never resolves, and `load('virtual:forge/index.js')` never returns: the workshop page never gets its index. `forgeTest`'s transform hangs the same way. Should answer `undefined` (not known) for a key whose answer is still being computed in the current chain.
- evidence: read
- severity: high

## Tracing `export *` cycles has no visited set, so the work grows exponentially
- where: packages/forge/src/vite/trace.ts:56 (declaring); packages/forge/src/vite/bindings.ts:66 (declaring)
- scenario: barrels `a.ts`: `export * from './b'; export * from './c'`, with `b.ts` and `c.ts` each doing `export * from './a'`, and a name none of them exports (a component looked up through the wrong barrel, or a callee that isn't forge's). Each visit to `a` branches twice and the only bound is `depth > 32`, so the lookup makes about 2^16 visits. In `trace.ts` every one of them calls `resolve` again, because `target` caches nothing. That means tens of thousands of vite `resolveId` calls for one story file, and the index or deps load stalls. Should keep a visited `(file, name)` set per lookup.
- evidence: read
- severity: medium

## `closeServer` is not a vite plugin hook, so Chromium and the capture cache outlive the dev server
- where: packages/forge/src/vite/plugin.ts:198
- scenario: `server.close()`, or a config-change restart that builds a new server, runs `buildEnd` and `closeBundle` but no `closeServer`. Vite's hook list has none by that name, and nothing in the repo calls one (grep finds only this line). So `capture.close()` never runs. The old endpoint's headless Chromium stays up until its 120 s idle timer fires, and each restart within that window leaves another one running. Should be `buildEnd`/`closeBundle`, or a `server.httpServer.on('close')` in `configureServer`. Not verified against vite's types: the tree has no node_modules.
- evidence: read (inferred: hook name checked against vite's documented hook list, not its typings)
- severity: medium

## A capture's box has no upper bound
- where: packages/forge/src/vite/capture/payload.ts:66 (parsePayload)
- scenario: a POST with `box: { width: 1e7, height: 1e7 }` and `dpr: 3` passes, because `positive` only checks `> 0`. `render` then calls `page.setViewportSize` and takes an element screenshot of that size. Chromium either fails or spends memory and the whole 20 s deadline on it, and every queued capture waits behind it. The cache drops results over 64 MB, so a repeat request does the work again. Should cap width and height (for example at the largest box a screen can host) and reject anything past it with 400.
- evidence: read
- severity: low

## `folderTitleReport`'s default `root = ''` makes every story file uncovered, so the check passes without checking
- where: packages/forge/src/vite/folderTitles.ts:63 (folderTitleReport, `under`)
- scenario: `IndexEntry.file` is absolute. With `root` left at `''`, `under` strips only the leading `/`, which turns `/repo/packages/ui/src/...` into `repo/packages/ui/src/...`. `folderTitles` then never sees its `rule.src` prefix and answers null for every file, and the report says `ok: true` with no lines. A `root` passed without a trailing slash also matches sibling directories (`/repo` matches `/repo2/...`). `titleReport` has the same `under`, which there only affects how paths print.
- evidence: read
- severity: low

## warnOnce and the capture endpoint import workspace packages that resolve only to dist
- where: packages/forge/src/vite/warnOnce.ts:1; packages/forge/src/vite/capture/endpoint.ts:3
- scenario: `ownKeys.ts` and `watchRecovery.ts` copy registry helpers because configs load these plugin files from source before any package is built. `warnOnce.ts` imports `@weasel-js/registry` and `endpoint.ts` imports `@weasel-js/core/json`, and `packages/core/package.json` maps `./json` to `./dist/json.js` only. `apps/forge/vite.config.ts` imports `packages/forge/src/vite/index.ts` → `plugin.ts`, which reaches both files (through shellTitle/titleReport → warnOnce and servePages → endpoint). On a checkout whose packages aren't built yet, the forge dev server's config fails to load. The decision "import no package from plugin source" is answered one way in ownKeys/watchRecovery/propTypes and the other way here.
- evidence: read (config import chain and core's exports map read; failure not run)
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

<!-- done: 6 findings, files read: 50 -->

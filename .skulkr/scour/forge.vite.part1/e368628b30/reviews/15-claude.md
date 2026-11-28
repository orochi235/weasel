# forge.vite.part1 findings

## The TypeScript reader recognizes forge's `meta`/`story` only through literal `@weasel-js/forge` specifiers, while the indexer follows any re-export
- where: packages/forge/src/vite/componentOf.ts:107 (isForgeWrapper)
- scenario: a project helper `kit.ts` does `export * from '@weasel-js/forge'` (or `import * as forge from '@weasel-js/forge'; export const { meta } = forge;`), and a story file writes `export default meta({ component: Button })` with `meta` imported from `./kit`. The indexer's wrapper resolver (`wrappers.ts`, through `trace.declaring`, which follows `export *` and destructured re-exports) reads this as a native meta, so the story indexes and the dependency graph finds `Button`. `isForgeWrapper` walks only Import/Export specifiers and requires one whose module specifier is literally `@weasel-js/forge`. For `export *` the alias chain resolves straight to forge's own `export { meta } from './story/…'` specifier, and for the destructured const it reaches a variable declaration, so it answers false. Then `objectOf` returns undefined: `componentOf` drops to the title stand-in, and `metaComponentOf` falls back to the `component` property of the meta's *type*, which gives a props type of `any` (or none). The prop table and controls lose the component that the index and graph do find. Both readers should give the same answer for the same callee.
- evidence: read (componentOf.ts isForgeWrapper; wrappers.ts:39-45 compares against `trace.declaring(forge, name)`; trace.test.ts:25 covers `export const { meta, story: makeStory } = forge` and `export *`)
- severity: medium
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: two definitions of "is forge's wrapper"
- confidence: likely

## A redirect hop's response body is never consumed or canceled
- where: packages/forge/src/vite/capture/browser.ts:80 (passThrough)
- scenario: an allowlisted origin answers with a 30x carrying a body (most servers send a short HTML body). The loop reads `location` and `continue`s without `response.body?.cancel()` or reading the body, and it does the same on the `reach` abort path. undici holds the connection and its buffers until the body is consumed or garbage-collected. A story whose assets redirect, captured repeatedly, ties up keep-alive sockets to that origin; the next hop or capture to the same origin can stall behind them until GC runs. Every hop should cancel the body it drops.
- evidence: read
- severity: low
- size: line
- cause: unconsumed fetch body
- confidence: likely

## Capture contexts are reused, so one capture's storage and cookies change later captures
- where: packages/forge/src/vite/capture/browser.ts:140 (contextCache)
- scenario: a context is kept per `dpr:secure` and reused for every capture. A story that writes `localStorage`, `sessionStorage`, IndexedDB or a cookie at render time (a persisted panel width, a "seen" flag) leaves that state in the context, and the next capture of any story at the same dpr starts with it. The PNG then depends on which captures ran before, and the endpoint caches it under a payload key that does not record that state, so the wrong image is served until `revise()`. Each capture should start from clean storage: a fresh context, or one whose storage is cleared before each capture.
- evidence: read
- severity: low
- size: function
- cause: shared browser context state
- confidence: likely

## `__namedExportsOrder` is dropped but its order is not applied
- where: packages/forge/src/vite/indexFile.ts:180 (indexProgram)
- scenario: a CSF file exports `__namedExportsOrder = ['B', 'A']`, which Storybook's CSF reader uses to order the stories (bundlers emit it for re-export-heavy files). Here it is only filtered out, and entries keep source order, so forge's tree and ids order the stories differently from Storybook for the same file, although this indexer otherwise ports Storybook's reading.
- evidence: read
- severity: low
- size: function
- cause: ported rule applied partially
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

<!-- done: 4 findings, files read: 27 -->

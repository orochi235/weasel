## folderTitles suggests a title its own `fits` rejects when no export matches the file name
- where: packages/forge/src/vite/folderTitles.ts:44 (folderTitles)
- scenario: `packages/ui/src/components/Bar/Foo.stories.tsx`, not under `lab/`, where folder `Bar` exports nothing named `Foo`. `takesFolder` is false, so `expected` = `ui/Bar/Foo` (the `?? name` fallback). But `fits('ui/Bar/Foo')` requires `exported.has('Foo')`, which is false. `folderTitleReport` tells the author to retitle to `ui/Bar/Foo`, and after they do, the same check fails again, suggesting the same title. The suggestion should be one that passes, or the report should say the file name matches neither the folder nor any export.
- evidence: read
- severity: medium

## A native story built by a member call or a call through a non-function binding is dropped from the index
- where: packages/forge/src/vite/nativeExports.ts:76 (mayBeStory, CallExpression case)
- scenario: a native file (`export default meta({...})`) with `export const Dark = Object.assign({}, Primary, { config: {...} })`, or `ns.story({...})` through `import * as ns from '@weasel-js/forge'`, or `const make = storyFactory(); export const A = make({...})`. `Object.assign` copies the enumerable `NATIVE` symbol that `story()` sets (define.ts:12), so at runtime the export is a story. But a callee that is not an Identifier returns `false`, and so does an Identifier bound to a non-function. `indexProgram` then filters the export out, so the workshop never lists it. This goes against the function's own rule that "what cannot be read stays in": every other expression it cannot read (`default: !isLiteralValue`) is kept.
- evidence: read
- severity: medium

## foreignStories caches the depth-limit answer by key, so the result depends on the order imports are visited
- where: packages/forge/src/vite/foreignStories.ts:56 (foreignStories → exported)
- scenario: the memo is keyed `${key}:${called}` alone. If a binding is first reached deeper than `MAX_DEPTH`, `undefined` is cached for it. A later, shallower path to the same binding reuses that `undefined` and never walks it. For a call, `undefined` becomes `foreign.call(...) ?? false` in mayBeStory, so a story that a shallow import chain would have proved is dropped. Whether it is dropped depends only on which export's chain was visited first.
- evidence: read
- severity: low

## The capture payload's box has no upper bound, so one request can ask Chromium for a viewport of any size
- where: packages/forge/src/vite/capture/payload.ts:66 (parsePayload); used at packages/forge/src/vite/capture/browser.ts:198 (render)
- scenario: a POST with `box: { width: 1e7, height: 1e7 }, dpr: 3`. The only check is `positive`, so `setViewportSize` and the element screenshot are asked for a 3e7-pixel-square PNG, which runs Chromium or the dev server out of memory (the PNG is also buffered whole). The Origin check passes any client that sends no `Origin` (`origin !== undefined` guard), and the server binds the LAN. `dpr` is clamped; the box should be too.
- evidence: read
- severity: low

## serveCapture.close() leaves a Chromium launched by a capture that arrives while it is closing
- where: packages/forge/src/vite/capture/endpoint.ts:168 (close)
- scenario: `close()` sets `launched = null`, then awaits the old browser's close. A POST arriving in that window (or one that was parsing its body) calls `browser()`, sees `launched === null` and calls `launchCaptureBrowser()` again. Nothing closes that new browser: `close` has already taken its snapshot, and nothing sets a closed flag that `browser()` checks. A headless Chromium is left running until its idle timer closes it (120 s), and that browser is rearmed if more captures arrive after the server is gone.
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

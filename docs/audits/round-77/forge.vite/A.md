# Audit round 77, forge.vite, blind reviewer findings

## A native story built through an imported alias or factory-made `story` is dropped, though the same code in-file stays in
- where: packages/forge/src/vite/foreignStories.ts:68 (declared)
- scenario: `helpers.ts` has `export const make = story;` (or `export const make = makeStoryFactory();`). The native story file does `import { make } from './helpers'; export const X = make({...})`. `make` is not one of forge's own bindings, so `declared(key, called=true)` runs `isFn(node) && …`. The node is an Identifier (or a CallExpression), so the answer is a definite `false`, and `foreign.calls.make = false`. `mayBeStory` then returns `scope.foreign?.call('make') ?? false`, which is false, and `X` is filtered out of the index. The same alias declared in the story file itself (`const make = story;`) takes `mayBeStory`'s `scope.bindings.has(callee)` branch, which gives `!isLiteralValue(fn)`, which is true, so the story stays in. One question, two answers. `declared` should give the non-function case the in-file rule (`!isLiteralValue(node, scope.bindings)`) instead of `false`.
- evidence: read
- severity: medium

## `returnsStory` misses returns inside `try`, `switch`, loops and labeled blocks, so a helper returning a story there drops it
- where: packages/forge/src/vite/nativeExports.ts:45 (returnsStory)
- scenario: `function make(args) { try { return story({ args }); } catch { return story({}); } }` followed by `export const X = make({...})`. `returnsStory` only looks into `ReturnStatement`, `BlockStatement` and `IfStatement`. A `TryStatement` (or `SwitchStatement`, `ForStatement`, `LabeledStatement`) gives `false`, so `mayReturnStory` is false and `X` leaves the index. `mayBeStory`'s own doc says "What cannot be read stays in". A statement kind the walk does not follow should count as maybe-a-story, or be followed.
- evidence: read
- severity: medium

## The in-file walk counts a call to `meta` as a story, while the foreign walk tells `meta` from `story`
- where: packages/forge/src/vite/nativeExports.ts:96 (mayBeStory, `scope.wrappers.has(callee.name)`)
- scenario: `scan` puts both `meta` and `story` locals into `wrappers`. So in a native file, `export const Shared = meta({...})` (a second meta used as a base) passes `mayBeStory` and gets indexed as a story, which the loader then rejects. The foreign path answers the same question differently: `exported` returns `called && own.get(key) === 'story'`, so a `meta` call is not a story. The two paths should share one decision.
- evidence: read
- severity: low

## `typeText` prints a function type inside a union or intersection without parentheses, which changes its meaning
- where: packages/forge/src/vite/typedoc/print.ts:18 (typeText, `union` / `intersection` cases)
- scenario: a parameter typed `((e: E) => void) | null`, which TypeDoc emits as a union of a `reflection` (a signature) and `null`, prints as `(e: E) => void | null`. That reads as a function returning `void | null`. Overload signatures shown in the API panel come from `signatureText`, which calls `typeText`, so the panel shows the wrong type. `union` maps parts with no grouping, and `intersection` groups only `union`. Both should wrap `reflection` signatures and `conditional` types, as `array` already does.
- evidence: read
- severity: low

## `prop()` takes the last property naming a key and ignores a later spread that overrides it
- where: packages/forge/src/vite/ast.ts:160 (prop)
- scenario: `export default { title: 'A/B', ...shared }`, where `shared` has a `title`. At runtime the spread wins. `prop(meta, 'title')` still returns `'A/B'`, so the index titles (and gives ids to) the stories differently from how the loader titles them. The same applies to `isolate`, `tags` and `name` on a story spec. The doc says "as an object literal evaluates". When a `SpreadElement` follows the matching property, the answer should be unknown (undefined), not the shadowed value.
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

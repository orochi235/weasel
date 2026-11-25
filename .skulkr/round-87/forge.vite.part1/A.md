# Audit round 87 — forge.vite.part1

## An optional method on a ref's handle is listed as a property typed `(() => void) | undefined`
- where: packages/forge/src/vite/apiTable.ts:200 (memberEntry)
- scenario: a component's `ref` exposes `interface Handle { focus(): void; reset?(): void }`. Under strictNullChecks, `getTypeOfSymbolAtLocation` for the optional `reset` is `(() => void) | undefined`, and `getCallSignatures()` of that union is empty, so the row gets `kind: 'property'` and the signature `(() => void) | undefined` instead of `kind: 'method'` with `() => void`. `propEntry`/`writtenType` and `refOf` all strip nullability with `getNonNullableType`; `memberEntry` does not.
- evidence: read
- severity: medium

## An edit that lands while the first `deps.js` build runs is never pushed, so the page keeps a stale graph
- where: packages/forge/src/vite/depsFeed.ts:94 (redeps) and :84 (module)
- scenario: the page requests `deps.js`, so `module()` starts `graphOf` (async import resolution between file reads). A component file is edited mid-build: the plugin invalidates it and calls `redeps`, but `depsSent` is still null because `module()` has not finished, so `redeps` does nothing. `module()` then finishes with a graph built partly from the pre-edit read, records it as `depsSent`, and serves it. The page holds that stale graph until some later edit triggers a rebuild. `module()` loops again only when `reset` bumps `generation`, not when an edit lands. It should treat an in-flight first build as "asked for" (or rebuild after one) so an edit during it is pushed.
- evidence: read
- severity: low

## The TypeScript reader and the babel indexer disagree on what a meta built by a non-forge helper names as its component
- where: packages/forge/src/vite/componentOf.ts:76 (objectOf), vs packages/forge/src/vite/ast.ts:296 (objectOf)
- scenario: `export default withDefaults({ title: 'ui/Buttons', component: Button })`, where `withDefaults` is a project helper that does not resolve to forge's `meta`. The TS `objectOf` steps into any call's first argument, so `componentOf`/`metaComponentOf` read `Button` and its props. The babel `objectOf` steps only through `wrappers`, so the indexer gets no meta object, `componentName` is undefined, and `bindings.componentOf` falls back to the title stand-in `Buttons`. The dependency graph and the API/props table then name different components, or the graph names none, even though `componentOf`'s doc says it picks the component "as the dependency graph picks it".
- evidence: read
- severity: low

## A computed `[component]` key is read as the literal key `component`
- where: packages/forge/src/vite/componentOf.ts:126 (keyName)
- scenario: given `const component = 'title'; export default { [component]: 'X', component: Real }`, or any computed key spelled as an identifier, `keyName` unwraps `ComputedPropertyName` and accepts an `Identifier` expression as its own text. So `[component]: Other` placed after the real `component` makes `componentIn` take `Other`. The babel `lookup` in ast.ts reads a computed key only when it is a string literal, so the two readers disagree. A computed identifier key should be unreadable (`undefined`), not its name.
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

## freeNames counts JSX intrinsic and namespaced tag names as references to values
- where: packages/forge/src/vite/freeNames.ts:126 (freeNames, `walk` case 'JSXIdentifier')
- scenario: a component renders `<label>` or `<svg:rect>`, and the file has a top-level `const label = …` or imports `label`/`rect`. Every `JSXIdentifier` that is not in scope goes into the free names, including the lowercase intrinsic tag of a `JSXOpeningElement` and both halves of a `JSXNamespacedName`. So the component is recorded as referring to that local or import, and `componentsReachedFrom` follows it, adding a false "uses" edge to the component graph. Only a capitalized tag name, or a JSXMemberExpression root, should count as a reference.
- evidence: read
- severity: low

## The component graph and the API table give different answers for a dotted `component` off a named import
- where: packages/forge/src/vite/bindings.ts:88 (componentOf) vs packages/forge/src/vite/componentOf.ts:29 (componentOf)
- scenario: a meta with `component: Tabs.Panel`, where `Tabs` is a named (not namespace) import. `bindings.componentOf` splits `Tabs.Panel`, sees that `imp.imported !== '*'`, and keys the component as `Tabs`'s binding. So the graph's `source`, `uses` and `usedBy` describe `Tabs`, and this title shares a key with the `Tabs` title. Meanwhile `componentOf.ts` reads `Tabs.Panel` through `getSymbolAtLocation` and builds the props/API table from `Panel`. The one story page then shows Panel's API next to Tabs's dependencies and history.
- evidence: read
- severity: low

## The history cache ignores release tags added after HEAD was read
- where: packages/forge/src/vite/history.ts:125 (createHistoryReader `read`)
- scenario: the dev server reads history at HEAD = X, and then `git tag v1.4.0` is put on X, as a release does after its version commit. `read` compares only `rev-parse HEAD`, which has not changed, so it keeps answering `introduced`/`modifiedIn: null` for files whose commits are now released, until some unrelated commit lands. The doc's premise ("every date comes from a commit, so nothing changes until one lands") does not hold for the `name-rev` half, which depends on tags. The cache key should include the tag refs too, for example `git rev-parse --tags` or `for-each-ref refs/tags`.
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

<!-- done: 3 findings, files read: 27 -->

# forge.vite.part1 — blind review findings

## The TS component lookup and the babel story indexer read a meta's spreads differently, so the API table and the dependency graph can name different components for one story file
- where: packages/forge/src/vite/componentOf.ts:132 (componentIn)
- scenario: `componentIn` reads a spread only through `checker.getSymbolAtLocation(property.expression)`. (a) `export default { ...(base as Meta), title: 'x' }`, with `const base = { component: Button }`, gives a ParenthesizedExpression/AsExpression with no symbol, so the spread is skipped and no component is found. Babel's `lookup` (ast.ts:325) unwraps the cast through `objectOf` and gives `componentName: 'Button'`. The same happens for an inline `...meta({ component: Button })`. (b) The other way round, `...shared` imported from another module resolves through the alias to that module's object in TS, while babel's `bindings` holds only top-level locals and reads it as setting nothing. The doc comment says the spread is read "as the story indexer takes it", but the two disagree in both directions. So `componentOf` (props and API) and `bindings.componentOf` (graph) can fall to different answers, one taking the meta's component and the other the title stand-in.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: spread read by symbol only, with no unwrapping of casts or wrappers, and imports followed where the indexer does not follow them
- confidence: likely

## `assignedNames` misses an assignment whose target is a TS cast or non-null, so a reassigned top-level `let` is read as its initializer
- where: packages/forge/src/vite/ast.ts:120 (assignedNames), packages/forge/src/vite/ast.ts:131 (patternNames)
- scenario: `let base = meta({ title: 'A' }); (base as any) = meta({ title: 'B' }); export default base;` (or `base! = …`). Babel puts a TSAsExpression or TSNonNullExpression as `left`, and `patternNames` answers `[]` for both. So `base` is never seen as reassigned, `bindingsOf` binds it to its first initializer, and the indexer titles the file 'A'. It should treat the binding as unreadable (the declarator), as it does for any other reassigned `let`. The same gap applies to such targets inside a destructuring (`[x!] = arr`).
- evidence: read
- severity: low
- fix: packages/forge/src/vite/ast.ts
- size: line
- cause: patternNames does not unwrap TS expression wrappers on an assignment target
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

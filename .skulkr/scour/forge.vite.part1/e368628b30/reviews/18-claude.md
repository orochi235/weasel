## An edit landing while `deps.js` is being served again can leave the page holding a stale graph
- where: packages/forge/src/vite/depsFeed.ts:101 (createDepsFeed → redeps / module)
- scenario: a page has loaded `deps.js` once, so `depsSent` is set. The page reloads, and `module()` starts a build that reads the pre-edit sources. A source edit then calls `redeps`. Because `depsSent !== null`, `rebuild` starts right away and runs alongside the build instead of being queued in `editedWhileServing`. If `rebuild` finishes first, it pushes the new graph over `forge:deps` before the reloading page has subscribed. `module()` then sets `depsSent` to the older JSON and serves it. The page keeps the pre-edit graph until another edit lands. It should get the post-edit graph: the edit should be queued as `editedWhileServing` whenever `serving` is true, whatever `depsSent` holds.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/depsFeed.ts
- size: line
- cause: the serving guard only applies before the first send
- confidence: likely

## A top-level `var` redeclared with a value in a block or a `for…of`/`for…in` head still counts as never reassigned
- where: packages/forge/src/vite/ast.ts:119 (assignedNames)
- scenario: `var meta = { title: 'A' }; if (flag) { var meta = { title: 'B' }; }` or `var s = X; for (var s of list) {}`. Each nested `var` with an initializer, and each `for (var x of …)` head, assigns the same top-level binding. `assignedNames` only counts `=`, `++` and `for` heads that are not a VariableDeclaration, and the top-level declaration of the name hides nothing. So `bindingsOf` keeps the first initializer as the binding's value, and `objectOf`/`stringOf` read a title, component or isolate value the module may not hold at runtime. Expected: the binding is treated as reassigned and bound to its declarator.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/ast.ts
- size: function
- cause: var declarators with init below top level not counted as assignments
- confidence: sure

## The meta's `component`, when it arrives through a spread with a cast or a wrapper call, is found by the babel indexer but not by the TS reader
- where: packages/forge/src/vite/componentOf.ts:139 (componentIn)
- scenario: `export default meta({ ...(base as Meta), title: 'X' })` or `{ ...story({ component: Button }) }`. The indexer's `lookup` in ast.ts goes through `objectOf`, which reads casts and forge wrapper calls, so `componentName` comes out as `Button`. `componentIn` calls `checker.getSymbolAtLocation(property.expression)`, which is undefined for an `as`/`satisfies`/parenthesized expression or a call. It finds no component, so the API table and prop controls go missing for a story whose component the index names. The two readers should give the same answer; `componentIn` should unwrap the spread expression the way `objectOf` does.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: spread argument read by symbol only, not unwrapped
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

<!-- done: 3 findings, files read: 27 -->

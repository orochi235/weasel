## componentOf's meta reader stops at an identifier argument, so the API table names a different component than the graph
- where: packages/forge/src/vite/componentOf.ts:79 (objectOf)
- scenario: `const config = { title: 'ui/Card', component: Button }; export default meta(config);`. The indexer's `objectOf` (ast.ts:281) follows the identifier through top-level `const`s, so the entry's `componentName` is `Button` and the dependency graph (bindings.ts `componentOf`) keys `Button`. componentOf.ts's `objectOf` sees an Identifier as `meta`'s argument (or as a `const meta = base` initializer), drops out of its loop with `undefined`, so `assigned` finds nothing and `componentOf` falls back to the title's last segment, `Card`. The props table shows Card's API, or none at all, while the graph says Button. The doc comment says it picks the component "as the dependency graph picks it". It should follow an identifier to its declaration's initializer, as the indexer does.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: identifier not followed in objectOf loop
- confidence: likely

## componentOf reads `component` through a spread of an imported object, which the indexer takes to set nothing
- where: packages/forge/src/vite/componentOf.ts:150 (componentIn)
- scenario: `import { base } from './shared'; export default meta({ ...base, title: 'ui/Card' })` where `base = { component: Button }`. `componentIn` resolves the spread's symbol across files and returns `Button`. The indexer's `lookup` (ast.ts:331) reads a spread only through the file's own `bindings`, finds no `base`, and records no `componentName`, so the graph keys the title stand-in `Card`. The API table and the dependency graph then describe different components. The function's own doc says a spread it cannot read "is taken to set nothing, as the story indexer takes it", but it reads spreads the indexer cannot. The two readers need to agree on how far they reach.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/componentOf.ts, packages/forge/src/vite/ast.ts
- size: function
- cause: two readers answer the same question differently
- confidence: likely

## A component whose props are a union lists only the props every member shares
- where: packages/forge/src/vite/apiTable.ts:42 (apiTable)
- scenario: `type Props = { kind: 'link'; href: string } | { kind: 'button'; onPress: () => void }`. `checker.getPropertiesOfType(getApparentType(props))` on a union returns only the common properties, so the table lists `kind` and drops `href` and `onPress`, along with their docs, defaults and type defs. The table should cover each member's props, for example by iterating `props.types` and marking the props that are not shared as conditional.
- evidence: read
- severity: low
- size: function
- cause: properties read from the union, not from its members
- confidence: likely

## An allowlisted response's multiple Set-Cookie headers collapse to the last one
- where: packages/forge/src/vite/capture/browser.ts:95 (passThrough)
- scenario: An allowlisted origin answers with two `Set-Cookie` headers. Iterating undici's `Headers` yields each `set-cookie` as a separate pair. `Object.fromEntries` keeps only the last, so the capture page gets one cookie, and a story whose later requests depend on the other one renders differently in the capture than on screen. Join the values with `\n`, which Playwright's `fulfill` accepts, or use `response.headers.getSetCookie()`.
- evidence: read
- severity: low
- size: line
- cause: header list flattened into a record
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

# Audit round 80 — forge.vite.part1 (reviewer findings)

## An empty meta `title` is kept as the title instead of falling back to the auto-title, unlike Storybook and unlike `id`
- where: packages/forge/src/vite/indexFile.ts:146 (indexProgram)
- scenario: a meta written `{ title: '' , component: X }` (or a `const TITLE = ''` it reads) → `stringOf(...) ?? autoTitle` keeps `''`, so every story gets title `''` and id `storyId('', name)`. Storybook's `userOrAutoTitleFromSpecifier` takes the auto-title when the user title is falsy, so forge's ids and links diverge from Storybook's for that file. The next line answers the same question the other way: `metaId` uses `|| undefined`, treating an empty id as absent.
- evidence: read
- severity: low

## The HMR socket guard closes vite's own client socket whenever HMR runs on a port or host other than the page's
- where: packages/forge/src/vite/capture/browser.ts:105 (guard)
- scenario: a dev server configured with `server.hmr.port` / `server.hmr.clientPort` / `server.hmr.host` (or behind a proxy that splits them) → vite's client connects to `ws://host:<hmr port>`, which is not `ownSocket` (built from the page URL's host), so `routeWebSocket` closes it. The comment above the call says closing that socket has the client reload the page mid-capture, so captures on such a server reload while rendering and fail or hit the 20 s deadline. The allowed socket should come from the server's resolved HMR config, not the page URL. (inference from the comment and vite's client behavior; not run)
- evidence: read
- severity: low

## `freeNames` reports `import.meta` / `new.target` as references to locals named `import`, `meta`, `new`, `target`
- where: packages/forge/src/vite/freeNames.ts:126 (walk, default → children)
- scenario: a `MetaProperty` node has no case, so `children` walks its `meta` and `property` Identifiers and both are added to the free names. A component that reads `import.meta.env.DEV` in a file with a top-level `const meta = …` or `target` helper is taken to reference that local, so `componentsReachedFrom` follows it and may record a `uses` edge the code does not have.
- evidence: read
- severity: low

## `freeNames` skips the decorators of class methods
- where: packages/forge/src/vite/freeNames.ts:104 (walk, isFunction branch)
- scenario: `ClassMethod` / `ClassPrivateMethod` go through the function branch, which walks only a computed key, params and body; their `decorators` (and parameter decorators on `params[i].decorators`, which `pattern` never visits for an Identifier) are never walked. A class component whose method is decorated with an imported helper (`@observer render() {…}`, `@bound handle()`) loses that reference, so the dependency graph misses what the decorator names. Class properties' decorators are walked (through `children`), so the two member kinds answer differently.
- evidence: read
- severity: low

## Inherited prop counts merge any two skipped packages whose declaring interface has the same name
- where: packages/forge/src/vite/apiTable.ts:46 (apiTable)
- scenario: the `inherited` map is keyed by `containerName(prop)` alone (e.g. `Props`, `BaseProps`, `Options`), with `packageOf` only as the fallback. A component whose props extend `Props` from package A and an unrelated `Props` from package B shows one line, `Props: N`, summing both, and the reader cannot tell the props come from two places. The key should carry the package when a container name is found.
- evidence: read
- severity: low

## A destructured default under a string-literal key is dropped from the API table
- where: packages/forge/src/vite/apiTable.ts:189 (destructuredDefaults)
- scenario: `function Field({ 'aria-label': label = 'Field', ...rest }: Props)` → `element.propertyName` is a StringLiteral, `tsm.isIdentifier(key)` is false, so `aria-label`'s default `'Field'` is never recorded and the table shows no default for it. A string-literal (or numeric) `propertyName` carries the prop name as `.text` just as an Identifier does.
- evidence: read
- severity: low

## `assigned` misses a meta's `component` written under a quoted key or through `<Meta>` / `!`
- where: packages/forge/src/vite/componentOf.ts:68 (assigned)
- scenario: `export default <Meta>{ component: Button }` or `{ 'component': Button }` → the walk only unwraps calls, parentheses, `as` and `satisfies` (not `TypeAssertion` / `NonNullExpression`, which `ast.ts`'s unwrappers all handle), and the property search accepts only Identifier names. `symbol` comes back undefined, so `local` is true and the title stand-in import, or the `component` property's declared type, is used instead of the component actually named — the API table can describe a different component from the dependency graph's for the same file.
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

<!-- done: 7 findings, files read: 26 -->

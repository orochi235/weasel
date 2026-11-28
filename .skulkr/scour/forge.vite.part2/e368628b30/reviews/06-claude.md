## A story file unlinked while a settle pass awaits its resolution is put back in the index with no entries
- where: packages/forge/src/vite/storyIndex.ts:103 (settle)
- scenario: `settleAll` (first load of `virtual:forge/index.js`) or one `update`'s settle is awaiting `decide(file, …)` for story S; meanwhile the watcher reports S unlinked and a concurrent `update` runs `current.delete(S)`/`wrappersOf.delete(S)`. When the await returns, settle does `wrappersOf.set(S, next)` and, the resolution differing from the now-undefined `before`, `readInto(current, S)`, whose `readFileSync` throws ENOENT: an error is logged and S is set back into the map with `[]`. S stays in `files()` (fed to propControls' TypeScript roots, re-settled on later events) and its stale `wrappersOf` entry keeps triggering re-reads, though the file is gone. The `current.has(file)` check is made only before the await; it should be repeated after it.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/storyIndex.ts
- size: line
- cause: membership check not repeated after await
- confidence: likely

## typedoc/index.ts keeps a private copy of packageNameOf beside packageName.ts's
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` decides which package a component file belongs to with its own walk-up (unbounded, `undefined` for none), while `apiTable.ts` and `history.ts` answer the same question through `packageName.ts`'s `packageNameOf` (bounded by `top`, `null` for none). Two definitions of "the package a file is in"; a change to one (e.g. how an unnamed or unreadable manifest is treated) silently leaves the typedoc lookup answering differently from the API table's package label.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## addTypeDefs takes every identifier-shaped word in a type's text, including string literals and property names
- where: packages/forge/src/vite/typeDefs.ts:39 (addTypeDefs)
- scenario: a prop typed `{ kind: 'Color' | 'Size' }` (or `mode: 'Theme'`) has its text scanned with `/[A-Za-z_$][\w$]*/g`, so `Color`, `Size`, `kind` are all looked up in scope; where the project declares a type `Color`, the API panel shows `Color`'s definition for a prop that never references it (and property keys that collide with type names do the same). Words inside quotes and before `:` in a member should be excluded, or the names taken from the type's references instead of its text.
- evidence: read
- severity: low
- size: function
- cause: regex scan over printed text
- confidence: likely

## TypeDoc lookup accepts a class component but reads no props from it
- where: packages/forge/src/vite/typedoc/index.ts:84 (exportIn) / :118 (propsTypeOf)
- scenario: `exportIn` admits `Kind.Class` exports, but `propsTypeOf` reads only `signatures[0].parameters[0].type ?? type`; a class reflection has neither (its props are in `extendedTypes`, `Component<P>`), so `collect` gets `undefined` and the component's TypeDoc props and ref members are always empty: no descriptions, deprecations or `inheritedFrom` reach the panel for a class component that TypeDoc documents, while it is still matched and given its `href`.
- evidence: read
- severity: low
- size: function
- cause: class reflection shape not read
- confidence: likely

## watchRecovery's transform takes a pending read recorded by the client load from any environment
- where: packages/forge/src/vite/watchRecovery.ts:160 (transform handler)
- scenario: `load` records a pending read only for the `client` environment, but `transform` calls `read.take(id)` in every environment before checking anything. With an ssr (or other dev) environment transforming the same id between the client's load and transform, the ssr transform consumes the entry and stamps it from its own module graph; the client's transform then finds nothing, so the client module is never stamped and an unreported edit to it is never recovered. The take should be guarded by `this.environment.name === 'client'` like the load.
- evidence: read
- severity: low
- size: line
- cause: environment guard missing on take
- confidence: likely

## A ref handle's accessor members lose their TypeDoc description
- where: packages/forge/src/vite/typedoc/index.ts:205 (memberDocs)
- scenario: TypeDoc writes an accessor's comment on its `getSignature`/`setSignature`, not on the accessor reflection; `memberDocs` falls back only to `signatures[0]?.comment`, which an accessor does not have, so `get value(): number` documented with `/** The current value. */` on a ref handle class shows no description or `@deprecated` in the panel.
- evidence: read
- severity: low
- size: line
- cause: accessor comment location not read
- confidence: likely

## Files read
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/packageName.ts
packages/forge/src/vite/plugin.ts
packages/forge/src/vite/posixPath.ts
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

<!-- done: 6 findings, files read: 26 -->

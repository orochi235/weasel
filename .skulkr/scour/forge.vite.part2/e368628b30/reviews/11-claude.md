# forge.vite.part2 findings

## TypeDoc lookup of a component's package is a second copy of `packageNameOf`
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` names a file's package with its own private `packageNameOf`, while `apiTable.ts` and `history.ts` use `vite/packageName.ts`'s. The two already differ: the typedoc copy has no `top` bound and returns `undefined` rather than `null`, and it reads every manifest without `existsSync`. A fix to how a package is named, such as the bound below, reaches one caller and not the other.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated decision
- confidence: sure

## `packageNameOf` treats `top` as a string prefix, so it reads manifests in a sibling directory
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: with `top = /repo/pkg` and a file at `/repo/pkg-extra/src/a.ts` (for example `history.ts` calling `resolve(top, path)` on a path holding `..`), `dir.startsWith(top)` is true for `/repo/pkg-extra/src` and `/repo/pkg-extra`, so the walk reads `/repo/pkg-extra/package.json` and returns that package's name. It should stop at once, since the file is not under `top`. It needs a check on the segment boundary (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: prefix match without separator boundary
- confidence: likely

## A class component matches a TypeDoc export but always gets no props or members
- where: packages/forge/src/vite/typedoc/index.ts:113 (propsTypeOf), :84 (exportIn)
- scenario: `exportIn` accepts `Kind.Class`, but `propsTypeOf` reads only `signatures[0].parameters[0]` or `type`. A TypeDoc class reflection has neither: its props live in its constructor's signature, or in `extendedTypes` (`Component<Props>`). So `collect` gets `undefined`, and `withTypedoc` merges an empty `ComponentDocs`: no descriptions, deprecations or `inheritedFrom` for any prop of a class component that TypeDoc documents. Only `href` is applied.
- evidence: read
- severity: low
- size: function
- cause: props type read only from function/variable shapes
- confidence: likely

## Two quick edits to one story file can leave the earlier, stale wrapper resolution in place
- where: packages/forge/src/vite/storyIndex.ts:101 (settle), :115 (update)
- scenario: `watchSources` fires `reindex` for each event without waiting for the one before it. Suppose file F is saved twice in quick succession. Update A starts `decide(F)` and its tracer parses F's old text. Update B starts `decide(F)` on the new text. If B's `await`s finish first, A writes `wrappersOf.set(F, staleResolution)` last and `readInto` re-reads F with it, so F is indexed with the wrappers its old imports implied (a meta imported through a helper reads as no meta, or the reverse) until F changes again. Updates to one file need to be serialized, or each needs a generation counter so that only the latest writes.
- evidence: read
- severity: low
- size: function
- cause: unserialized concurrent async updates
- confidence: likely

## A merged interface's definition prints only its first declaration
- where: packages/forge/src/vite/typeDefs.ts:58 (addTypeDef)
- scenario: when `interface Options { a: string }` is augmented elsewhere with `interface Options { b: number }` (declaration merging, or module augmentation), `symbol.getDeclarations().find(definedBy)` takes the first declaration only. The API panel's definition of `Options` then shows `{ a: string }` and leaves out `b`. It should show every member the type has.
- evidence: read
- severity: low
- size: function
- cause: first declaration taken for a merged symbol
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

<!-- done: 5 findings, files read: 26 -->

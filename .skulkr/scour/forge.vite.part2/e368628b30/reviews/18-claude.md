## TypeDoc prop docs are never found for a `memo`-wrapped component
- where: packages/forge/src/vite/typedoc/index.ts:131 (collect)
- scenario: `export const Button = memo(function Button(props: ButtonProps) {…})`. TypeDoc types the export as `MemoExoticComponent<(props: ButtonProps) => Element>`. `collect` looks through the external reference to its type argument, which is a `reflection` holding a call signature and no `children`. The `reflection` branch reads only `declaration.children`, so it collects no props. Every prop row then keeps only the live reader's text, with no TypeDoc description, `@deprecated` or inheritedFrom. `forwardRef` works only because its argument is an intersection of references. The lookup should go through a lone call signature's first parameter, the same way `propsTypeOf` does for a function export.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: line
- cause: reflection branch ignores signatures
- confidence: likely

## A rejected prop-reader promise is cached for the server's life
- where: packages/forge/src/vite/propControls.ts:108 (propControls transform)
- scenario: `reader ??= createPropReader(...)` stores the promise. If `createPropReader` throws after TypeScript loads (`parseJsonConfigFileContent`/`createLanguageService` failing on a broken project config or host), the stored promise is rejected. Every later story transform then awaits that same rejection and fails, until `configResolved` runs again. The failure should give null, as a missing `typescript` does, or the promise should not be kept.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/propControls.ts, packages/forge/src/vite/propTypes.ts
- size: line
- cause: rejected promise memoized
- confidence: likely

## Two `packageNameOf` implementations answer the same question
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `typedoc/index.ts` defines its own private `packageNameOf(dir)` next to the exported `packageNameOf(file, top)` in `packageName.ts`, which `apiTable.ts` and `history.ts` use. The two copies differ: one takes a directory and returns `undefined`, the other takes a file and returns `null`, with a `top` bound. Any fix to one, such as a boundary rule or manifest handling, will not reach the TypeDoc tie-break.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## `packageNameOf`'s `top` bound is a string-prefix test, not a path-segment test
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = '/repo/pkg'` with `file = '/repo/pkg-other/src/a.ts'`. `'/repo/pkg-other'.startsWith('/repo/pkg')` is true, so the walk reads `/repo/pkg-other/package.json` and returns that package's name, although the file is not at or under `top` as the doc says. The reverse also fails: a `top` with a trailing slash (`'/repo/'`) stops before it checks `/repo/package.json` itself.
- evidence: read
- severity: low
- size: line
- cause: prefix compare without separator
- confidence: sure

## A story file deleted during the first settle comes back as an empty entry
- where: packages/forge/src/vite/storyIndex.ts:101 (settle)
- scenario: `settleAll` checks `current.has(file)` and then awaits `decide(...)`. If the file is unlinked during that await, `update('unlink')` deletes it from `current` and `wrappersOf`. The resumed settle then sets `wrappersOf` for it again and calls `readInto`. `readInto` catches the ENOENT and calls `current.set(file, [])`, so the deleted file is back in `files()`: as a TypeScript program root, in `fallbackOf`, and as a stale `wrappersOf` entry whose `reads` keep starting settles. It should check again after the await that the file is still in `current`.
- evidence: read
- severity: low
- size: line
- cause: membership not rechecked after await
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

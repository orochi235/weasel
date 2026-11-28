## watchRecovery's quiet sweep replays an edit the watcher is about to report, warning "changed with no file event" and pushing it twice
- where: packages/forge/src/vite/watchRecovery.ts:105 (sweep / missed)
- scenario: a file is saved at T; the sweep interval fires at T+δ, before chokidar reports the change (off macOS `settledWatch` holds every change for awaitWriteFinish's 50 ms stability; fsevents itself reports ~100 ms late). `lastEvent` is older than `quietMs`, `missed(file)` sees the new mtime, so `recover` logs the "[watch] … changed with no file event; pushing it to the page" warning and emits `change`. Then the real event arrives and vite processes the same edit again: a false warning on a healthy watcher and a double HMR update/reload. With a 2 s sweep and ~50–100 ms latency this hits a few percent of ordinary saves. The check should only treat a change as missed once its mtime is older than the watcher's own latency (e.g. `Date.now() - mtime > grace`).
- evidence: read
- severity: low
- size: function
- cause: no grace period between mtime and expected event
- confidence: likely

## A user's own `watchRecovery({ quietMs })` placed after `forge()` is silently inactive
- where: packages/forge/src/vite/plugin.ts:101 (companions)
- fix: packages/forge/src/vite/plugin.ts, packages/forge/src/vite/watchRecovery.ts
- scenario: `plugins: [forge({ stories }), watchRecovery({ quietMs: 10_000 })]`. forge always adds its own default `watchRecovery()` first; `configResolved` makes only the first copy by name active, so the user's `quietMs` is dropped with no warning, and `ForgeOptions` has no way to configure or turn off forge's copy. Either the companion should defer to a copy already in `config.plugins`, or forge should take the options.
- evidence: read
- severity: low
- size: function
- cause: first-copy-wins with forge always first
- confidence: likely

## A component documented in one package hands its TypeDoc docs to a same-named component in an undocumented package
- where: packages/forge/src/vite/typedoc/index.ts:81 (exportIn)
- scenario: TypeDoc (packages strategy) writes paths relative to each package, so package A's `Button` has `sources[0].fileName = 'src/Button.tsx'`. Package B also exports `Button` from `packages/b/src/Button.tsx` but is not in the TypeDoc run. For B's story, `suffixOf` matches A's export (B's path ends with `/src/Button.tsx`), there is only one candidate, and `found.length <= 1` returns it without the package check that the tie branch applies. B's API panel shows A's descriptions, deprecations, overloads and `href`. The package-name check should apply whenever the suffix is shorter than the full path, not only on ties.
- evidence: read
- severity: medium
- size: function
- cause: package check only on ties
- confidence: likely

## TypeDoc source paths written with a leading `../` never match, so the component gets no TypeDoc docs
- where: packages/forge/src/vite/typedoc/index.ts:71 (suffixOf)
- scenario: TypeDoc run from a subdirectory (e.g. `docs/`) with entry points `../packages/ui/src/index.ts` writes `fileName: '../packages/ui/src/Button.tsx'`. `suffixOf` strips only a leading `./`, so it tests `at.endsWith('/../packages/ui/src/Button.tsx')`, which no absolute path does; every component reads as undocumented. Leading `../` segments should be stripped like `./`.
- evidence: read
- severity: low
- size: line
- cause: only `./` prefix normalized
- confidence: likely

## A native story file's plain value exports such as `-1`, `a + b`, `new Map()` or `undefined` are indexed as stories
- where: packages/forge/src/vite/nativeExports.ts:118 (mayBeStory)
- fix: packages/forge/src/vite/nativeExports.ts, packages/forge/src/vite/ast.ts
- scenario: in a native file, `export const MIN = -1;` (UnaryExpression), `export const label = 'a' + 'b';` (BinaryExpression), or `export const none = undefined;` reach the `default`/`Identifier` branches: `UnaryExpression`/`BinaryExpression`/`NewExpression`/`TemplateLiteral`-free expressions are not in `LITERALS`, so `!isLiteralValue` says "may be a story", and the global `undefined` is read as an unresolved import (`foreign.value('undefined') ?? true`). indexFile.ts:158 keeps each, so the sidebar lists stories that are not ones. The doc comment says "a value written out is not". Likewise a bare `return;` in a helper (`mayBeStory(undefined)` → true). Globals (`isGlobal`) and operator expressions over literals should read as values.
- evidence: read
- severity: low
- size: function
- cause: globals and operator expressions not treated as values
- confidence: likely

## typedoc/index.ts keeps its own `packageNameOf` beside packageName.ts's
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- fix: packages/forge/src/vite/typedoc/index.ts
- scenario: "which package a file belongs to" is answered by two walks: `packageName.ts`'s `packageNameOf` (used by apiTable and history) and a private copy here that differs in its not-found value (`undefined` vs `null`) and in how it stops. A fix to one (e.g. bounding the walk) does not reach the other. Fold this one into the shared function.
- evidence: read
- severity: low
- size: function
- cause: duplicated decision
- confidence: sure

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

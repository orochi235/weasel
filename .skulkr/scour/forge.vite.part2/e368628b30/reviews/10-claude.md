## mayBeStory reads a function's inner locals and parameters as the top-level bindings they shadow, so a real story export can be judged "not a story"
- where: packages/forge/src/vite/nativeExports.ts:118 (mayBeStory, Identifier case; reached through mayReturnStory/returnsStory)
- scenario: `const s = { a: 1 }; function wrap(s) { return s; } export const A = wrap(story(...));` — `mayCallStory(wrap)` follows the `return s`, looks `s` up in the file's top-level `bindings`, finds the object literal and answers false, so the loader drops `A` even though it is what `story` returned. The same happens for a `const` declared inside the function body under a top-level name. A name bound inside the function should read as unknown (true), not as the outer binding.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/nativeExports.ts
- size: function
- cause: no scope tracking for function params/locals
- confidence: likely

## Story files added later outside the vite root are never indexed: only the files globbed at startup are added to the watcher
- where: packages/forge/src/vite/plugin.ts:74 (watchSources)
- scenario: `stories: ['../packages/*/src/**/*.stories.tsx']` (globs are relative to the root, and `globSync` accepts `../`). At startup each existing match is `watcher.add`ed, but the directories themselves are not, so creating a new story file under `../packages/x/src` emits no `add` event (vite watches only the root and files it has served); the workshop never shows it until the server restarts. Watching each glob's static base directory would cover it.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/plugin.ts
- size: function
- cause: watches files, not glob bases
- confidence: likely

## The nearest-package-name lookup is written twice, once in packageName.ts and again privately in typedoc/index.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` calls its own `packageNameOf(dirname(file))` instead of `packageNameOf(file)` from `packageName.ts`; the two walks agree today (both skip nameless and unparsable manifests) but answer one question in two places, so a fix to one (e.g. a `top` bound) misses the other. Duplicate of a decision, per the one-pathway rule.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: line
- cause: duplicated helper
- confidence: sure

## A rejected TypeScript reader is cached, so one failure disables prop controls and the API panel for the rest of the server's life
- where: packages/forge/src/vite/propControls.ts:107 (propControls transform)
- scenario: `reader ??= createPropReader(...)` stores the promise; if `createPropReader` throws past its `require` guard (e.g. `parseJsonConfigFileContent` or `createLanguageService` throwing on a broken `tsconfig.json`), the rejected promise stays in `reader` and every later story transform rejects with the same error, failing every story module, even after the tsconfig is fixed, until a config reload. It should fall back to null (and warn) rather than poisoning every transform.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/propControls.ts
- size: line
- cause: rejected promise memoized
- confidence: likely

## moduleInfo exports `declare`d values, which have no runtime binding
- where: packages/forge/src/vite/moduleInfo.ts:43 (declareStatement)
- scenario: `export declare const meta: ...` or `export declare function story(...)` in a `.ts` file is recorded as a local export and traced as the binding a name is declared as; `TSEnumDeclaration` already skips `declare`, but `VariableDeclaration`/`FunctionDeclaration` (`TSDeclareFunction` aside) with `declare: true` do not, so the tracer can resolve a name to a declaration that does not exist at runtime instead of following on.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/moduleInfo.ts
- size: line
- cause: missing `declare` check
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

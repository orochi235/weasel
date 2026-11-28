## TypeDoc lookup takes a lone suffix match from another package without checking its package
- where: packages/forge/src/vite/typedoc/index.ts:91 (exportIn)
- scenario: TypeDoc JSON documents only package `a`, whose `Button` lives at `src/Button.tsx` (paths written relative to the package). A story in package `b` for `b/src/Button.tsx` exporting `Button` gets one suffix candidate, and `found.length <= 1` returns it, so b's API panel shows a's descriptions, deprecations, overloads and href. The package check runs only when two or more candidates tie, so it never runs on the case it was written for when the right package is missing from the JSON.
- evidence: read
- severity: medium
- size: line
- cause: package check skipped for a single candidate
- confidence: likely

## A second copy of the package-name lookup in typedoc/index.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `vite/packageName.ts` already exports `packageNameOf(file, top)`, which apiTable and history use; typedoc/index.ts defines its own private `packageNameOf(dir)` with a different signature, a different not-found value (`undefined` vs `null`) and no `top` bound. One question is answered in two places, and a fix to one (such as the prefix bound below) won't reach the other.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated helper
- confidence: sure

## packageNameOf bounds the climb with a string prefix, not a path segment
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: with `top = '/repo/app'` and a file at `/repo/app-old/src/x.ts` (history.ts resolves a path against `top`, and a `../app-old/...` path gets there), `'/repo/app-old/src'.startsWith('/repo/app')` is true. So it reads `/repo/app-old/package.json` and returns a package outside `top`, when it should return null.
- evidence: read
- severity: low
- size: line
- cause: startsWith instead of segment-aware containment
- confidence: likely

## `export default interface X {}` is recorded as a value default export
- where: packages/forge/src/vite/moduleInfo.ts:96 (moduleInfo, ExportDefaultDeclaration)
- scenario: Babel parses `export default interface Props {}` as an ExportDefaultDeclaration whose declaration is a TSInterfaceDeclaration. It is not a function, class or identifier, so the code falls to `declare(DEFAULT_LOCAL, decl)` and sets `exports.default` to a local binding. `trace.declaring(file, 'default')` then resolves a type-only module's default to `file#<default>` as though it were a runtime value. A type-only default should export nothing, as the `exportKind === 'type'` paths do for named exports.
- evidence: read
- severity: low
- size: line
- cause: type-only default declarations not filtered
- confidence: likely

## fileEventsArrive never settles for a NaN wait
- where: packages/forge/src/vite/watchProbe.ts:84 (fileEventsArrive)
- scenario: `waitMs: NaN` (for example, parsed from an unset env var) makes `waitMs <= LONGEST_TIMER_MS` false, so no deadline is set. Where the OS reports nothing, the promise never resolves and the 250 ms rewrite interval keeps writing the temp file for the life of the process. The docs promise an endless wait only past 2^31 − 1 and at Infinity. A NaN (or negative) wait should be rejected or treated as 0.
- evidence: read
- severity: low
- size: line
- cause: unvalidated computed delay
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

<!-- done: 5 findings, files read: 26 -->

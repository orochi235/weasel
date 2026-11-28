## packageNameOf's `top` bound is a string prefix, so it fails on Windows and leaks into sibling directories
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: history.ts:128 calls `packageNameOf(resolve(top, path), top)` with `top` from `git rev-parse --show-toplevel`, which on Windows is `C:/repo`, while `resolve` gives `C:\repo\...`; `dir.startsWith(top)` is false at the first step, so every file reads as package `null` and only unscoped tags are searched for releases. On any platform, a `top` of `/repo/pkg` also admits `/repo/pkg-extra` (string prefix, not path containment), and a `top` with a trailing slash never checks `top` itself because `dir === top` and `startsWith` both miss. It should compare normalized paths by segment (e.g. `relative(top, dir)` not starting with `..`).
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/packageName.ts
- size: line
- cause: path containment tested by string prefix over mixed separators
- confidence: likely

## Two copies of "nearest package.json name": typedoc/index.ts re-implements packageNameOf
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: packageName.ts exports `packageNameOf(file, top)` (returns `null`, checks `existsSync`, takes a bound); typedoc/index.ts defines a private `packageNameOf(dir)` (returns `undefined`, no bound) answering the same question. A fix to one (such as the bound above, or how an unreadable manifest is treated) does not reach the other, so the API panel's TypeDoc match and history's package grouping can name different packages for one file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## A type definition declared `export default interface` prints as `default interface …`
- where: packages/forge/src/vite/typeDefs.ts:71 (addTypeDef)
- scenario: a props type written `export default interface Props { … }` is found by `definedBy` (an InterfaceDeclaration); the printed text is `export default interface Props {…}` and the regex `^(export\s+)?(declare\s+)?` strips only `export `, leaving `default interface Props {…}` as the definition shown in the API panel. The `default` modifier should be stripped too.
- evidence: read
- severity: low
- size: line
- cause: modifier regex misses `default`
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

<!-- done: 3 findings, files read: 26 -->

## typedoc/index.ts keeps its own `packageNameOf`, answering "which package owns this file" differently from `packageName.ts`
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` disambiguates two same-suffix exports by `packageNameOf(dirname(file))`, a private copy that climbs to the filesystem root with no `top` bound and returns `undefined`. `packageName.ts`'s `packageNameOf(file, top)`, which apiTable.ts and history.ts use, takes a file rather than a dir and returns `null`. The same question now has two implementations that can drift: a fix to one, such as bounding the climb or caching reads, misses the other.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated helper
- confidence: sure

## `packageNameOf` bounds the climb with a bare string prefix, so a sibling directory sharing `top`'s prefix passes, and a `top` ending in a separator is never checked itself
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: Take `top = '/repo/pkg'` and `file = '/repo/pkg-extra/src/a.ts'`. `'/repo/pkg-extra'.startsWith('/repo/pkg')` is true, so the function reads `/repo/pkg-extra/package.json` and returns that name. The doc says the manifest must be "at or under `top`". If `top` is instead written `'/repo/pkg/'`, `dirname` never produces a trailing slash, so `'/repo/pkg'.startsWith('/repo/pkg/')` is false: `top`'s own manifest is skipped and the function returns null. The comparison should be on path segments (`dir === top || dir.startsWith(top + sep)`, with `top` normalized).
- evidence: read
- severity: low
- size: line
- cause: string prefix used as path containment
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

<!-- done: 2 findings, files read: 26 -->

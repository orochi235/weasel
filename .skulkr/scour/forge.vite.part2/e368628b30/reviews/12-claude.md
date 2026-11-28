## typedoc/index.ts keeps a second `packageNameOf` beside packageName.ts's, answering "which package owns this file" two ways
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: the private copy has no `top` bound and skips the `existsSync` check, while `packageName.ts`'s `packageNameOf` (used by apiTable.ts and history.ts) takes a `top`. The two return different types (`undefined` vs `null`) and stop under different conditions, so a fix to one, such as the prefix bug below, never reaches `exportIn`'s tie-break.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## packageNameOf bounds its climb with a string prefix, so a sibling directory whose name starts with `top` counts as being inside it
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: with `top = '/repo/pkg'` and `file = '/repo/pkg-extra/src/a.ts'`, every ancestor `/repo/pkg-extra/...` passes `dir.startsWith(top)`. The function reads `/repo/pkg-extra/package.json` and returns that package's name. It should return null, because the file is not at or under `top`. The check needs a path-segment boundary (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: prefix check without separator
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

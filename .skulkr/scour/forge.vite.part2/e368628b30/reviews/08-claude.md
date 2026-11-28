## typedoc/index.ts keeps its own copy of packageNameOf beside packageName.ts's
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: the nearest package name for a file is answered by `packageName.ts`'s `packageNameOf` (used by apiTable.ts and history.ts) and again by a private copy in typedoc/index.ts that takes a directory instead of a file, returns `undefined` instead of `null`, and has no `top` bound. A fix to one (e.g. how an unreadable or nameless manifest is skipped, or a bound on how far up it climbs) leaves `exportIn`'s package tie-break answering differently from the API table's package label for the same file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated lookup
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

<!-- done: 1 findings, files read: 26 -->

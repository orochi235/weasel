## typedoc/index.ts keeps a second copy of "the nearest package.json name", beside packageName.ts's packageNameOf
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` breaks a TypeDoc tie by the file's package and calls its own private `packageNameOf(dirname(file))`, while `apiTable.ts` and `history.ts` ask the same question through `packageName.ts`'s `packageNameOf(file, top)`. The two already differ: one returns `undefined` and has no `top` bound, the other returns `null` and is bounded. A fix to one (a manifest cache, a stop at the repo root, a change to how an unreadable manifest is treated) leaves the API panel's tie-break answering differently from the API table's package label for the same file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## A type definition declared `export default interface …` prints as `default interface …` in the API panel
- where: packages/forge/src/vite/typeDefs.ts:69 (addTypeDef)
- scenario: a component's props type is `export default interface Props { … }` (or `export default enum`). The printer keeps both modifiers, and the strip regex `^(export\s+)?(declare\s+)?` removes only `export `, so the definition shown is `default interface Props { … }`, which is not TypeScript. It should read `interface Props { … }`.
- evidence: read
- severity: low
- size: line
- cause: strip regex misses `default`
- confidence: likely

## warnOnce's per-logger set has no bound and never forgets, unlike registry's capped createWarnOnce it copies
- where: packages/forge/src/vite/warnOnce.ts:9 (warnOnce)
- scenario: across a long dev session every distinct message is kept forever: each `story id X is declared by …` from `warnShared` (one per id and file set, and the text includes paths) and each dropped `allowOrigins` entry. The set only grows. There is a second consequence: once a story-id collision is fixed and then reintroduced, the same text is never logged again, so the workshop silently shows only the first story and gives no warning. Registry's `createWarnOnce`, which the comment says this replaces, has a `cap` (unruled.md, round 85) and forgets old messages. This copy leaves that out.
- evidence: read
- severity: low
- size: function
- cause: unbounded seen-set
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

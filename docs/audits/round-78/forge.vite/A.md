# Audit round 78 — forge.vite findings

## `watchRecovery({ quietMs: 0 })` (or a negative value) starts a ~1 ms interval that stats every served file forever
- where: packages/forge/src/vite/watchRecovery.ts:139 (watchRecovery, configureServer)
- scenario: `quietMs` is only checked against `LONGEST_TIMER_MS`, never against a lower bound. With `quietMs: 0` (or `-1`), `setInterval(sweep, quietMs)` fires at the clamped minimum (~1 ms), and `Date.now() - lastEvent < quietMs` is never true, so every tick runs `missed()` → `statSync` on every file vite has served, for the life of the server. It should reject or clamp a non-positive value (or treat it as "check only on request", as it does for `Infinity`).
- evidence: read
- severity: low

## A story file that fails to parse on an edit keeps its old entries, where one that fails on first read has none
- where: packages/forge/src/vite/storyIndex.ts:126 (update), also :103 (settle)
- scenario: `files()` documents and implements "a file that fails to parse stays in the map with no entries". In `update`, a `change` whose `read(file)` throws only logs; `current` still holds the entries from the previous text (only `add` sets `[]`). So after an edit that breaks the file the workshop keeps listing stories from the old source, and `importers.js` keeps importing the broken file, while the same broken file on a fresh server shows nothing. The same thing happens in `settle`'s re-read. The two paths answer "what does a broken file index as" two ways.
- evidence: read
- severity: low

## `inferred` TypeDoc types print without `infer`, so a conditional type's signature reads wrong
- where: packages/forge/src/vite/typedoc/print.ts:7 (typeText)
- scenario: TypeDoc's JSON writes `infer U` as `{ type: 'inferred', name: 'U' }`. `typeText` groups `'inferred'` with `'intrinsic'` and returns just `name`, so `T extends Array<infer U> ? U : never` in a member's overload is printed `T extends Array<U> ? U : never`: a different, generally invalid type. It should print `infer ${name}` (plus ` extends …` for a constraint).
- evidence: read
- severity: low

## Mapped types print without their `readonly`/`?` modifiers or `as` clause
- where: packages/forge/src/vite/typedoc/print.ts:44 (typeText, `mapped`)
- scenario: TypeDoc's mapped type carries `readonlyModifier`, `optionalModifier` and `nameType`; `TdType` doesn't declare them and `typeText` drops them. `{ [K in keyof T]?: T[K] }` (Partial-like) is shown as `{ [K in keyof T]: T[K] }`, required, and `{ [K in keyof T as `on${K}`]: … }` loses its key remapping. The signature in the API panel then states a different type.
- evidence: read
- severity: low

## forge always runs the watch probe, so adding `watchProbe()` beside `forge()` probes twice and logs the warning twice
- where: packages/forge/src/vite/plugin.ts:74 (watchSources) / packages/forge/src/vite/watchProbe.ts:128 (watchProbe)
- scenario: `watchSources` calls `warnWhenWatchIsSilent(server)` unconditionally, and `watchProbe()`'s `configureServer` calls it again. Nothing de-duplicates them (unlike `watchRecovery`, which runs only its first copy by name, and unlike `warnOnce`, which this path doesn't use). A dev server whose config adds both writes two temp probes and, when events are silent, logs the same multi-line warning twice. Either forge should skip its probe when a `weasel-watch-probe` plugin is present, or the warning should go through `warnOnce`.
- evidence: read
- severity: low

## `bindingsOf` ignores top-level class declarations, so a native story file exporting a local class indexes it as a story
- where: packages/forge/src/vite/ast.ts:19 (bindingsOf); consumed by packages/forge/src/vite/nativeExports.ts:98 (mayBeStory, `Identifier`)
- scenario: `bindingsOf` stores variable initializers and function declarations but not a `ClassDeclaration` (only a default-exported one), while `moduleInfo` does declare classes. In a native file with `class Harness {}` and `export { Harness }`, `indexProgram` reads the export as the identifier `Harness`; `mayBeStory` finds no binding, asks `foreign.value('Harness')`, which `foreignStories` answers `undefined` (it isn't an import), and falls to `true`. The class becomes a story entry, which the loader then fails on. The same gap makes `isGlobal` treat such a class as a global (`class Object {}` shadowing would read as the built-in `Object.assign`). It should be stored as a binding, so `isLiteralValue`/`LITERALS` (which would need `ClassDeclaration`) rule it out.
- evidence: read
- severity: low

## `forgeTest` never transforms a story file outside the vite root, which `forge` indexes
- where: packages/forge/src/vite/forgeTest.ts:30 (matches)
- scenario: With `stories: ['../packages/*/src/**/*.stories.tsx']`, `forge`'s index (`globSync` + `storyIndex.matches`, which only excludes `node_modules`) lists those files, but `forgeTest`'s `matches` returns false for any path starting `../`, so the file becomes no test and no story runs. The two plugins answer "is this a story file" differently for the same `stories` globs.
- evidence: read
- severity: low

## The issues endpoint turns a non-array `gh` answer into an unhandled 500 instead of its 502
- where: packages/forge/src/vite/issues/endpoint.ts:114 (serveIssues, answer)
- scenario: Only `JSON.parse` is guarded. If `gh` prints valid JSON that is not an array (an object or `null`, as some `gh` versions/extensions print for errors on stdout), `listed.map` throws inside `answer`, the promise rejects and `next(err)` makes vite answer a generic 500 HTML error, rather than the `{ error }` 502 body with `repo`/`branch`/`commit` the endpoint promises for "gh answered something unexpected". `listed` should be checked with `Array.isArray`.
- evidence: read
- severity: low

## TypeDoc lookup matches a component's file by path suffix, so a same-named export in another package's same-suffixed file can be taken
- where: packages/forge/src/vite/typedoc/index.ts:49 (readTypedoc, component)
- scenario: `at.endsWith('/' + fileName)` where TypeDoc's `fileName` is relative to its base path (e.g. `src/Button.tsx`). In a monorepo whose TypeDoc JSON covers several packages, `/repo/packages/ui/src/Button.tsx` and `/repo/packages/kit/src/Button.tsx` both end with `/src/Button.tsx` if the JSON's paths are package-relative, and `find` returns whichever `Button` export comes first, so one component's API panel shows the other's descriptions, deprecations and page link. Matching should resolve `fileName` against the JSON's base directory and compare whole paths.
- evidence: read (inference about TypeDoc path base in multi-package JSON)
- severity: low

## Files read
packages/forge/src/vite/apiTable.ts
packages/forge/src/vite/ast.ts
packages/forge/src/vite/autoTitle.ts
packages/forge/src/vite/bindings.ts
packages/forge/src/vite/build.ts
packages/forge/src/vite/capture/browser.ts
packages/forge/src/vite/capture/cache.ts
packages/forge/src/vite/capture/endpoint.ts
packages/forge/src/vite/capture/entries.ts
packages/forge/src/vite/capture/payload.ts
packages/forge/src/vite/componentGraph.ts
packages/forge/src/vite/componentOf.ts
packages/forge/src/vite/componentReach.ts
packages/forge/src/vite/depsFeed.ts
packages/forge/src/vite/entries.ts
packages/forge/src/vite/folderTitles.ts
packages/forge/src/vite/foreignStories.ts
packages/forge/src/vite/forgeTest.ts
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/plugin.ts
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

<!-- done: 9 findings, files read: 50 -->

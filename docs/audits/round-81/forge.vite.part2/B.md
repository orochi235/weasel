# Audit round 81 — forge.vite.part2 findings

## Story files keyed by native paths are compared with vite's `/`-separated ids, so prop controls, API tables and `forge:story` never fire on Windows
- where: packages/forge/src/vite/propControls.ts:105 (propControls → transform), packages/forge/src/vite/plugin.ts:117 (storiesReaching)
- scenario: `createStoryIndex`'s `glob()` keys `files()` by `resolve(root(), f)`, which on Windows is `C:\app\src\Button.stories.tsx`. `propControls.transform` checks `stories().includes(id)` and `storiesReaching` checks `current.has(mod.file)`, where vite's `id` / `mod.file` are normalized to `C:/app/src/Button.stories.tsx`. Neither ever matches: no story gets argTypes or its API export, and no `forge:story` event is sent on an edit. The module elsewhere does care about Windows (`posixPath.ts`, `[\\/]` regexes in propTypes/typeDefs, `normalizePath` in watchRecovery). Should normalize one side (e.g. `normalizePath`) before comparing.
- evidence: read (vite's id normalization is inference from its documented behavior, not run)
- severity: medium

## `fileEventsArrive` arms a bare `setTimeout` with the caller's `waitMs`, so a long or infinite wait reports "no events" at once
- where: packages/forge/src/vite/watchProbe.ts:80 (fileEventsArrive)
- scenario: `fileEventsArrive({ waitMs: Infinity })` (or any value past 2^31 − 1 ms) — `setTimeout` clamps the delay to 1 ms, the deadline fires immediately and resolves `false` before the watcher can report the write, so `warnWhenWatchIsSilent` logs a false "OS file watcher reports nothing" warning. This is the computed-delay timer the repo routes through `after`; watchRecovery.ts guards the same case with `LONGEST_TIMER_MS`, this file does not.
- evidence: read
- severity: low

## The issues endpoint accepts any array of objects as a list of issues, then answers rows with missing fields
- where: packages/forge/src/vite/issues/endpoint.ts:67 (isIssueList), :117 (answer)
- scenario: `gh` answering `[{}]` (or rows lacking `number`/`url`/`createdAt`, e.g. a gh version that renames a field) passes `isIssueList`, and the 200 answer carries `ForgeIssue`s whose `number`, `title`, `url` and `opened` are `undefined`; the 502 "not a list of issues" branch meant for exactly this never runs. The guard should check each field's type.
- evidence: read
- severity: low

## Files read
packages/forge/src/vite/issues/endpoint.ts
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
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

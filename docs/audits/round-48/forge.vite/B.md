I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole document is below. One more thing to know: this checkout's HEAD is `d057251407`, not the frozen `7c016ebfdf` the brief names, so the line numbers are from `d057251407`.

# Audit round 48 — forge.vite — blind reviewer findings

## A story file added while it fails to parse is never indexed, even after it is fixed
- where: packages/forge/src/vite/storyIndex.ts:123 (createStoryIndex `update`)
- scenario: Someone creates a new `Foo.stories.tsx` that matches the globs, but it doesn't parse yet (a half-typed save or a partial paste). On `update(file, 'add')`, `own = matches(file)` is true and `read(file)` throws. The catch logs the error and returns null, but never calls `current.set(file, [])`. On the next save (`change`), `own = current.has(file)` is false and `through` is empty, because no other story file reads this one. So `update` returns null for this file on every later edit, and its stories never appear until the server restarts. `files()` documents the opposite rule ("A file that fails to parse stays in the map with no entries, so an edit that fixes it re-indexes it"), and the startup glob path follows it.
- evidence: read
- severity: medium

## Headless Chromium that crashes or disconnects is reused, so every capture fails until two quiet minutes pass
- where: packages/forge/src/vite/capture/browser.ts:132 (launchCaptureBrowser `browser` / `contextFor`)
- scenario: `chromium` holds a resolved `Browser`, and `contexts` holds its resolved contexts. Nothing listens for `disconnected`. If Chromium crashes or is killed, `contextFor` keeps returning the dead context, `newPage()` rejects, and each POST gets a 500. The only reset is `shut()` on the 120 s idle timer. Each capture clears that timer and re-arms it, so a user who keeps requesting captures never gets a working browser back. The fix is to drop `chromium` and `contexts` when the browser disconnects.
- evidence: read
- severity: low

## A capture queued when the endpoint closes relaunches Chromium after close
- where: packages/forge/src/vite/capture/endpoint.ts:167 (`close`) with packages/forge/src/vite/capture/browser.ts:120 (`shut`) and :132 (`browser`)
- scenario: Several captures are queued on `tail`, and the dev server restarts or closes. `close()` calls `result.close()`, which is `shut()`: that sets `chromium = null` and clears `contexts`. The next queued `shoot` then calls `contextFor` → `browser()`, which sees `chromium === null` and launches a new Chromium. Nothing owns that browser any more. It lives until the unref'd 120 s idle timer fires, and in a process that stays up across a config restart it is an orphaned browser. After close, `capture` should reject, not relaunch.
- evidence: read
- severity: low

## `folderTitles` suggests a title its own `fits` rejects, and compares the folder name case-sensitively although the rule says case is ignored
- where: packages/forge/src/vite/folderTitles.ts:38 (folderTitles `expected` and `fits`)
- scenario 1: For `components/Keycaps/Keycap.stories.tsx`, where the folder exports `KeyCap`, `fits('ui/Keycaps/KeyCap')` is true because the export match ignores case. But `expected` is `ui/Keycaps/Keycap`, built from the file name with `name === own`, and `fits` of that is false because there is no export `Keycap`. So `check:forge-titles` tells the author to retitle to a title that fails the same check.
- scenario 2: `components/Button/button.stories.tsx` cannot take `ui/Button`, because `name === own` is case-sensitive. The doc comment says the file is named for the title's last segment "ignoring case", and the export branch does lowercase.
- evidence: read (folderTitles.test.ts:27 pins the case-insensitive export match)
- severity: low

## An exception from the watch probe's temp-dir setup becomes an unhandled rejection that can crash the dev server
- where: packages/forge/src/vite/watchProbe.ts:29 (fileEventsArrive), called via `void warnWhenWatchIsSilent(...)` at plugin.ts:68 and watchProbe.ts:100
- scenario: `mkdtempSync(join(tmpdir(), 'forge-watch-'))` runs outside the promise and outside any try. If TMPDIR is unwritable, full or missing, it throws inside the async `warnWhenWatchIsSilent`, and that function's promise is dropped with `void`. Under Node 24's default `--unhandled-rejections=throw`, the forge dev server and every app using `watchProbe()` exit at startup. It should log a warning or skip the probe. The same applies to `rmSync` in `settle`, which runs inside a timer callback with no try.
- evidence: read
- severity: low

## A meta's negated tags are kept as literal tags, unlike a story's
- where: packages/forge/src/vite/indexFile.ts:226 (combineTags)
- scenario: With meta `tags: ['autodocs', '!test']`, `new Set(meta)` puts the literal `'!test'` into every story's tags. A story's own `'!x'` is treated as a removal and never stored. Storybook folds every level the same way, so `'!test'` would never appear as a tag. Here one function answers "is `!x` a tag?" both ways depending on the level, and the ported tag model diverges from Storybook's.
- evidence: read
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

<!-- done: 6 findings, files read: 50 -->
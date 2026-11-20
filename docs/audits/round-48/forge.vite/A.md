I couldn't write `.skulk/out/findings.md` because the permission was denied, so the whole findings document is below.

# Findings: forge.vite (blind reviewer)

The brief names frozen commit 7c016ebfdf6a5facdd58c7d93e390fdfdd4ffe84, but that commit doesn't exist in this clone. I read HEAD d057251407 instead; the listed files have no uncommitted changes.

## A story file added while it fails to parse is never indexed, even after an edit fixes it
- where: packages/forge/src/vite/storyIndex.ts:111-129 (update)
- scenario: With the dev server running, create `Foo.stories.tsx` and save it first with a syntax error.
  - On the `add` event, `own = matches(file)` is true and `read(file)` throws. The error is logged and `update` returns null, because no other story reads the file. The file is never put in `current`.
  - The save that fixes it arrives as a `change` event. There `own = current.has(file)` is false, so it is ignored too.
  - The stories never appear, and `importers.js` never lists the file, until the server restarts.
  - At startup such a file stays in the map with no entries "so an edit that fixes it re-indexes it" (line 66). plugin.test.ts:223 covers only that startup case. The add path should do the same thing: `current.set(file, [])` when the read fails.
- evidence: read
- severity: medium

## The shell config's title and allowOrigins are not read when the config is an exported const
- where: packages/forge/src/vite/shellTitle.ts:17-26 (configOf)
- scenario: A shell config written as `export const config = defineShellConfig({ title: 'Kit' }); export default config;`, or one that uses `export const title = 'Kit'` as shorthand `{ title }`.
  - `configOf` collects bindings only from bare `VariableDeclaration`s, not from the declaration inside an `ExportNamedDeclaration`. So the identifier resolves to nothing.
  - The document, served and built, gets the default title.
  - Every `capture.allowOrigins` entry is silently dropped. No "dropped" warning appears either, because the array is never found.
  - `indexFile.scan` reads the same shape correctly (indexFile.ts:88), so the two readers of a top-level const disagree.
- evidence: read
- severity: low

## A Chromium that crashes or disconnects is kept, failing every capture until two quiet minutes pass
- where: packages/forge/src/vite/capture/browser.ts:132-141 (browser), 146-160 (contextFor)
- scenario: The headless Chromium dies (OOM kill, crash, or killed by hand).
  - `chromium` still holds the resolved, now disconnected `Browser`, and `contexts` still holds its dead contexts. Nothing listens for `disconnected`.
  - Every capture POST then fails with a 500 ("Target page, context or browser has been closed").
  - Each capture re-arms the idle timer, so while the workshop keeps asking, the dead browser is never replaced. It recovers only after `IDLE_CLOSE_MS` with no capture at all.
  - It should drop `chromium` and `contexts` on `disconnected`, so the next capture relaunches.
- evidence: read
- severity: low

## Browser contexts are made per distinct device pixel ratio and never closed while captures keep coming
- where: packages/forge/src/vite/capture/browser.ts:146-160 (contextFor)
- scenario: `dpr` can be any float in [1, 3]. Browser zoom changes `devicePixelRatio` (1.1, 1.25, 1.5, 2.2, …, and values like 1.100000023841858).
  - Each distinct value opens a new `BrowserContext`, cached in `contexts` with no cap and no eviction.
  - They are released only by the idle shutdown, which a workshop in steady use never reaches. Each context holds its own renderer memory.
  - It should use a bounded cache, or round dpr to a few steps, and close the contexts it evicts.
- evidence: read
- severity: low

## One dangling symlink matching the story globs breaks the whole index
- where: packages/forge/src/vite/storyIndex.ts:55 (glob)
- scenario: A broken symlink named like a story file is returned by `globSync`.
  - `statSync(f)` throws ENOENT inside the filter, so `files()` throws, `index.js` fails to load, and the workshop shows nothing.
  - It should skip that one path instead, using `statSync(f, { throwIfNoEntry: false })?.isFile()`.
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

<!-- done: 5 findings, files read: 50 -->
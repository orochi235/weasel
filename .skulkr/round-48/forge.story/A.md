# forge.story — blind review, round 48

Note: the checkout's HEAD is d057251407, not the frozen 7c016ebfdf named in the brief (git commands needed approval, so
the diff between them was not checked). Line numbers are as on disk.

## A native story whose `name` is `''` is named `''` by the loader but by its export name in the index
- where: packages/forge/src/story/native.ts:22 (loadNativeModule)
- scenario: `export const Primary = story({ name: '', render })`. The static indexer (`vite/indexFile.ts:158`) uses
  `||`, so the tree lists it as "Primary". `loadNativeModule` uses `spec.name ?? storyNameFromExport(exportName)`, so
  the loaded story, and with it the trial and the index page, is named `''`. The ruling of 2026-11-10 in
  `docs/unruled.md` (line 1307) says an empty name falls through so that the tree and the trial name a story alike;
  the CSF loader does that (`loadCsfModule.tsx:164`, `||`), but the native loader does not.
- evidence: read
- severity: low

## `primaryFile` misses the component's own file when the title's last segment has a space or separator
- where: packages/forge/src/story/indexPages.ts:28-30 (primaryFile)
- scenario: title `ui/Color Field`, files `…/ColorField.stories.tsx` and a `…/lab/ColorFieldArc.stories.tsx` that the
  index lists first. `'color field' !== 'colorfield'`, so no file matches and the function falls back to `files[0]`,
  the lab file. The index page's description, library, API table and the stories' order then come from the lab file.
  The doc comment says the primary file is "the one named for the title's last segment". Titles with spaces are
  normal in this repo (the tests use `ui/Color Field`). The comparison should ignore separators the way the file name
  can't hold them.
- evidence: read
- severity: low

## The index page loads a sanitize-colliding title's stories under the other title
- where: packages/forge/src/story/indexBundle.ts:74-77 (loadIndexBundle)
- scenario: `labkit/Lab` (in A.stories.tsx) and `Labkit/Lab` (in B.stories.tsx) share one index page, as
  `indexEntries` intends. `loadIndexBundle` loads every file with `title = primary.title`, so B's stories come back
  with `title: 'labkit/Lab'`. Their `StoryContext.title` and `LoadedStory.title` on the index page then differ from
  the title the same story has in the index and in its own trial, where it loads as `Labkit/Lab`. Loading each file
  under its own entries' title would keep the title the same everywhere.
- evidence: read
- severity: low

## Files read
packages/forge/src/story/Counter.stories.tsx
packages/forge/src/story/api.ts
packages/forge/src/story/declarationEmit.fixture.ts
packages/forge/src/story/define.ts
packages/forge/src/story/ids.ts
packages/forge/src/story/indexBundle.ts
packages/forge/src/story/indexPages.ts
packages/forge/src/story/library.ts
packages/forge/src/story/load.ts
packages/forge/src/story/native.ts
packages/forge/src/story/tags.ts
packages/forge/src/story/types.ts

<!-- done: 3 findings, files read: 12 -->

## A story merged onto another title's index page renders with that title, not its own
- where: packages/forge/src/story/indexBundle.ts:77 (loadIndexBundle)
- scenario: stories titled `labkit/Lab` (fileA) and `Labkit/Lab` (fileB) share one index page since dae9ee24a9. `loadIndexBundle` loads every file with the primary entry's title (`load(mods[i], title, …)`), so fileB's stories come back with `title: 'labkit/Lab'` and their `StoryContext.title` / CSF context say `labkit/Lab`. Opened on its own, the same story is loaded with its entry's title (`packages/forge/src/frame/mountFrame.tsx:100`, `Labkit/Lab`). One story renders with two different titles depending on whether it is seen on the index page or alone; each file should be loaded with its own entries' title.
- evidence: read
- severity: low

## primaryFile misses the file named for a title whose last segment has spaces or separators
- where: packages/forge/src/story/indexPages.ts:29 (primaryFile)
- scenario: title `ui/Segmented Bar` with files `[lab/SegmentedBarArc.stories.tsx, SegmentedBar.stories.tsx]` in index order. The name compared is `segmented bar` (raw lower-case) against stems `segmentedbararc` and `segmentedbar`; nothing matches, so the first file (`SegmentedBarArc`) becomes primary and its meta supplies the component description, `componentName`, library and API table for the index page. Same for `ui/segmented-bar` against `SegmentedBar`. The comparison should normalize both sides (drop spaces, dashes, underscores) so the file named for the component wins, as the doc promises.
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

<!-- done: 2 findings, files read: 12 -->

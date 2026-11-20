
## The Issues panel goes blank when the focused trial shows a component's index page
- where: packages/forge/src/shell/issues/issuesSection.tsx:10-11 (FocusedIssues), fed from packages/forge/src/shell/Workshop.tsx:187
- scenario: Workshop passes `issuesSection(index, …)` the story entries only; the index pages exist only in `entries` (`[...index, ...indexEntries(index)]`, Workshop.tsx:149). Open a component's row in the sidebar, which opens its index page (`<title>` + index suffix) in the focused trial. `FocusedIssues` looks the trial's `instrumentName` up in `index`, finds nothing, and returns null: the aside's "Issues" section is empty, with no list and no Report button, on the one page that is about that component as a whole. It should resolve index pages too (pass `entries`, or map an index id back to its component's title) and list that component's issues.
- evidence: read
- severity: medium

## Every open story of a file loads and prepares the whole file again, replacing its siblings' loaded stories
- where: packages/forge/src/shell/storyLoads.ts:85-124 (useStoryLoads → request), driven by packages/forge/src/shell/documentInstrument.tsx:91-94 (StoryLoad)
- scenario: three trials show stories A, B and C of one file, and the file is edited (or the three open together before the first load lands). `reload` drops all three, each pending face's `StoryLoad` effect calls `request` for its own entry, and nothing dedupes requests: the import is shared, but each request runs `loadModule` again and `prepare` for every sibling (3 × 3 prepares), and each `settle` writes fresh `LoadedStory` objects for all siblings. The second and third settles replace A's, B's and C's `Loaded` with new objects after they have already rendered, so `buildEntry` sees `held.loaded !== had` and rebuilds every sibling's instrument (new schema object, new `initialState`) once per request. A file should be loaded and prepared once per generation, with later requests for its entries joining that load.
- evidence: read
- severity: low

## Files read
packages/forge/src/shell/issues/TrackedIssues.tsx
packages/forge/src/shell/issues/issues.css
packages/forge/src/shell/issues/issuesSection.tsx
packages/forge/src/shell/issues/tracker.ts
packages/forge/src/shell/keptFrame.ts
packages/forge/src/shell/keys/KeysPanel.tsx
packages/forge/src/shell/keys/keyRows.ts
packages/forge/src/shell/keys/keys.css
packages/forge/src/shell/keys/keysChrome.ts
packages/forge/src/shell/labDensity.ts
packages/forge/src/shell/labHarness.ts
packages/forge/src/shell/mountWorkshop.tsx
packages/forge/src/shell/readyKey.ts
packages/forge/src/shell/revealTrial.ts
packages/forge/src/shell/routedTrial.ts
packages/forge/src/shell/shell.css
packages/forge/src/shell/storyChanges.ts
packages/forge/src/shell/storyHosts.ts
packages/forge/src/shell/storyInstrument.tsx
packages/forge/src/shell/storyLoads.ts
packages/forge/src/shell/storyMarks.ts
packages/forge/src/shell/storyShow.ts
packages/forge/src/shell/tree/StoryTree.tsx
packages/forge/src/shell/tree/buildComponents.ts
packages/forge/src/shell/tree/buildTree.ts
packages/forge/src/shell/tree/folderReveal.ts
packages/forge/src/shell/tree/openStory.ts
packages/forge/src/shell/tree/sidebarViews.ts
packages/forge/src/shell/tree/treeRows.tsx
packages/forge/src/shell/treeReveal.ts
packages/forge/src/shell/trialFrames.ts
packages/forge/src/shell/useOverflowing.ts
packages/forge/src/shell/useRoute.ts
packages/forge/src/shell/useStoryRegistry.ts

<!-- done: 3 findings, files read: 34 -->

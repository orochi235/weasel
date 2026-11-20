# Findings: forge.shell.part2

## Focusing a second trial of the routed story overwrites its knobs with the first trial's URL params
- where: packages/forge/src/shell/routedTrial.ts:10 (routedTrial), as used by RouteKnobs.tsx:69-74
- scenario: trials T1 and T2 both show story X; T1 is focused, so the URL is `#/X?size=10` written from T1's knobs. T2 holds `size=20`. The user focuses T2 (clicking it; no route change). `routedTrial` now answers T2 because it prefers the focused trial, `RouteKnobs` keys `KnobSync` on `[T2, X]`, it remounts with `reading = true`, `takeRouteFromTrial()` is false (no entry was stamped), and it writes the URL's `size=10` (and every leaf the URL leaves unset back to its default) over T2's config. T2's knobs are lost just by focusing it. Moving the routed trial to another one should write that trial's knobs into the URL (as `fromTrial` does for `openStory`), not read the URL into it.
- evidence: read (routedTrial.ts:9-12, RouteKnobs.tsx:21-55, useRoute.ts:70-76)
- severity: medium

## The Issues section is empty for a trial showing a component's index page
- where: packages/forge/src/shell/issues/issuesSection.tsx:10 (FocusedIssues)
- scenario: the user opens a component's row in the sidebar, which runs its index page (`indexId(title)`) in the focused trial. `FocusedIssues` looks the trial's instrument up in `index`, which `Workshop.tsx:187` passes as the story list without `indexEntries(index)` (the workshop's own `entries`, line 149, has them). No entry is found, so it returns null and the Issues section shows nothing: no list and no Report, on the very page that stands for the component. Index-page entries carry `title` and `componentName`, so the lookup should include them.
- evidence: read (Workshop.tsx:149,187; story/indexPages.ts:53-77)
- severity: medium

## The story hosts table keeps a ref for every trial id it has ever seen
- where: packages/forge/src/shell/storyHosts.ts:19 (createStoryHosts → ref)
- scenario: `ref(trialId)` adds a `{ current }` to `refs` the first time a trial id is asked for (by `attach` and by `storyMarks`' `targets`), and nothing ever deletes it: a detach only nulls `current`. Over a session that opens and closes trials, each new trial id leaves an entry for the life of the workshop. The table has no bound and no removal path.
- evidence: read
- severity: low

## mountWorkshop silently replaces a caller's `changes` and `revision`
- where: packages/forge/src/shell/mountWorkshop.tsx:36 (mountWorkshop)
- scenario: `MountWorkshopOptions extends WorkshopProps`, so it accepts `changes?: StoryChanges` and `revision?: Revision`, which `Workshop` documents and subscribes to (Workshop.tsx:53,66,168). `mountWorkshop` builds `{ ...props, changes, revision }` with its own fresh emitters, so a caller that passes its own `changes` and emits an edited file on it, or shares a `revision` with something else, is ignored with no error: no story reloads and no capture is invalidated except through the returned handle. Either honour the given ones (`props.changes ?? createStoryChanges()`) or remove them from the options type.
- evidence: read
- severity: low

## Sidebar folds are stored per path while folder rows are told apart per library, so two folders sharing a path open and close together
- where: packages/forge/src/shell/tree/StoryTree.tsx:81 (expanded / onExpandedChange)
- scenario: in the Components view, `componentNodes` keys folders by `compositeKey([library, path])` and `treeRowsFor` numbers their row ids apart (`folder:a/Icons`, `folder:a/Icons#2`), as `freshKey`'s doc says happens when a `libraries` table puts rows of one title prefix in two libraries. But `expanded` and `onExpandedChange` map each row id through `pathOf` onto the one `folds[path]` entry, so expanding either row expands both, and collapsing one collapses the other. Likewise a reveal (`scrollToRow(keyOf(folder))`, line 123) always scrolls to the un-numbered first row. The row identity and the fold identity answer "which folder" two ways.
- evidence: read (treeRows.tsx:13-20, buildComponents.ts:139)
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

<!-- done: 5 findings, files read: 34 -->

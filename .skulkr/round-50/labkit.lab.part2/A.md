# Findings: labkit.lab.part2 (round 50, blind reviewer)

## nebulaStyle counts a ramp nebula against weaselTheme, not the lab's theme, so a ramp only the lab's theme declares throws
- where: packages/labkit/src/lab/nebula.ts:42 (nebulaStyle)
- scenario: `<Lab theme={myTheme} nebula={{ ramp: 'aurora' }}>` where `aurora` is a ramp declared on `myTheme` (or on interstellarTheme, the lab's default) but not on `weaselTheme`, in dark mode. `colorCount(nebula)` is called without a context, so it falls back to `defaultContext()` (`weaselTheme`, packages/theme/src/colorListItems.ts:81) and `rampSteps(weaselTheme, 'aurora')` throws `Theme "weasel" has no ramp "aurora"` during render. `buildNebula` right below does pass the lab's theme, and `LabBaseProps.nebula` promises "A theme ramp resolves against the lab's theme". Should test emptiness against the same `{ theme, resolved }` context `buildNebula` builds (a ramp shared by both themes with a different step count also gets its emptiness answered from the wrong theme).
- evidence: read
- severity: medium

## Every floating panel is pinned to the same top-right corner, so a second one covers the first entirely
- where: packages/labkit/src/lab/Workspace.less:47 (.lk-panel-tile--floating), packages/labkit/src/lab/tileChrome.tsx:35 (FloatingPanels)
- scenario: two trials each undock a sidebar section as `'floating'` (`undockPanel(id, 'floating')`, packages/labkit/src/trial/useTrialPanels.ts:21). `FloatingPanels` renders both frames into `.lk-workspace__floating`, and each is `position: absolute; top: var(--wzl-space-md); right: var(--wzl-space-md); width: 260px`, so the later one is drawn exactly over the earlier, which can no longer be seen or reached. Nothing places them apart: `workspaceStore.ts:34` registers a `floating`-strategy zone (`FLOAT_ZONE_ID`) for them, but no node is ever registered in it and `FloatingPanels` never renders a `Container` for it, so the strategy that would position each panel is never consulted. Should stack, offset, or lay the panels out through that zone.
- evidence: read
- severity: medium

## Toggling `reorderable` on a Workspace remounts every tile, trials and their state included
- where: packages/labkit/src/lab/Workspace.tsx:145 (Workspace), packages/labkit/src/lab/tileChrome.tsx:93 (createTileChrome, TRIAL_KIND)
- scenario: a `<Workspace reorderable={editing}>` whose caller flips `editing`. The grid's element changes from `<Container>` to `<DragProvider><Container/></DragProvider>`, and each trial tile from `<Lightbox>` to `<TrialDragContext.Provider><Lightbox/></TrialDragContext.Provider>`; React sees a different element type at both positions and unmounts and remounts the grid and every tile's content, dropping unpersisted trial state and GL contexts. The same file goes out of its way to avoid this for `lightbox` ("`disabled` rather than leaving the wrapper out, so turning the lightbox off cannot remount the tile", tileChrome.tsx:83), so the prop doc's "Off by default" toggle should be held to the same rule: always render the providers, with a null/disabled value.
- evidence: read
- severity: low

## `onReorder` hands back tile-panel node ids (`lk-panel-<key>`), and a trial id with that prefix renders as an empty panel
- where: packages/labkit/src/lab/Workspace.tsx:116 (commitOrder), packages/labkit/src/lab/workspaceStore.ts:87 (useTileSync)
- scenario: (a) a direct `<Workspace ids={ids} panels={[{ key: 'p', as: 'tile', … }]} reorderable onReorder={setIds}>` consumer, as the prop doc invites ("The full id list a drop would produce"): after a drop the list includes `lk-panel-p`, which the caller stores as `ids`; `ids` is positionally matched to `children`, so every child after it takes the next child's id and inherits its extent, and the last child falls back to `lk-ws-N`. `<Lab>` survives only because `reorderTrials` filters unknown ids. Should report only the children's ids. (b) a child whose id starts with `lk-panel-` is registered with `kind: 'panel'` (kind decided by string prefix), finds no descriptor in `panelByNode`, and renders nothing. Kind should come from which list the id came from, not its spelling.
- evidence: read
- severity: low

## Files read
packages/labkit/src/lab/TriallessPage.tsx
packages/labkit/src/lab/UnreadableRecords.tsx
packages/labkit/src/lab/Workspace.less
packages/labkit/src/lab/Workspace.stories.less
packages/labkit/src/lab/Workspace.stories.tsx
packages/labkit/src/lab/Workspace.tsx
packages/labkit/src/lab/fitCheck.ts
packages/labkit/src/lab/index.ts
packages/labkit/src/lab/keyClaims.ts
packages/labkit/src/lab/labAmbient.ts
packages/labkit/src/lab/labChords.ts
packages/labkit/src/lab/labChromeAll.ts
packages/labkit/src/lab/labContextMenus.ts
packages/labkit/src/lab/labMenus.ts
packages/labkit/src/lab/labModes.ts
packages/labkit/src/lab/labProps.ts
packages/labkit/src/lab/nebula.ts
packages/labkit/src/lab/openLab.ts
packages/labkit/src/lab/owningTrial.ts
packages/labkit/src/lab/panelHost.ts
packages/labkit/src/lab/presentation.less
packages/labkit/src/lab/presentation.tsx
packages/labkit/src/lab/presentationMessages.ts
packages/labkit/src/lab/snapshotCommands.ts
packages/labkit/src/lab/still.ts
packages/labkit/src/lab/storeCommands.ts
packages/labkit/src/lab/tileChrome.tsx
packages/labkit/src/lab/trialless.ts
packages/labkit/src/lab/useFocusPick.ts
packages/labkit/src/lab/workspaceStore.ts

<!-- done: 4 findings, files read: 30 -->

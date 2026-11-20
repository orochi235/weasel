## Copy settings as JSON ignores the instrument's auto reports, so it copies values the trial does not run with
- where: packages/labkit/src/chrome/trialActions.tsx:23 (settingsJson)
- scenario: a config leaf declared `.initial(AUTO).auto()` (no resolver, no `auto.value`) whose instrument works the value out and reports it through `RenderContext.reportAuto` (say 42). The Settings panel quotes 42: `ControlPanel` shows `withAutoReports(resolveAutoConfig(...), reported, auto)` (controls/ControlPanel.tsx:203). "Copy settings as JSON" runs only `resolveAutoConfig(ctx.configSchema, ctx.config, ctx.auto)`, which removes that path (autoConfig.ts: "A path where neither gives one is removed"), so the key is missing from the JSON. For a leaf whose `.auto(fn)` resolver gives one value and whose instrument reports another, the JSON has the resolver's value, though `withAutoReports` says the report "outranks the path's resolver: it is what the instrument actually used". The copy should carry the reported value (`ctx.reported` is right there on the context), the same answer the panel gives, as the function's doc ("at the values it runs with") promises.
- evidence: read
- severity: medium

## A toolbar contribution without `end` that merges after a built-in `end` group lands at the far end
- where: packages/labkit/src/chrome/regions/ToolbarRegion.tsx:95 (ToolbarRegion), packages/labkit/src/chrome/regions/groupsOf.ts:15 (groupsOf)
- scenario: `useTrialContributions` merges built-ins first, then `instrument.chrome`, then the trial's and the lab's `chrome`. The built-ins end the toolbar with the `trial` group marked `end` (`export` when the instrument has annotations, and `snapshot-load` once one snapshot is saved). An instrument contributing `{ id: 'run', region: 'toolbar', item: {...} }` with no `end` comes after that group in `groupsOf`'s first-appearance order, and `Bar.Group end` "pushes this group, and everything after it, to the far end" (ui Bar/barParts.tsx:8). So `run` renders right of Export / Load snapshot at the far end, and in a trial without annotations it jumps from the near end to the far end the moment the first snapshot is saved. `ContributionBase.end` (types.ts:124) says `end` pushes *this contribution and its group* to the far end; unmarked contributions should stay on the near side. `groupsOf` needs to put non-end groups ahead of end groups (or the region needs to), not leave it to arrival order. StatusRegion has the same arrival-order effect: an instrument's status readout merged after the built-in `fps` (`end: true`) renders after the spacer, beside the FPS meter, and its own doc ("the first one marked `end`, and every one after it") contradicts `ContributionBase.end`.
- evidence: read
- severity: medium

## A group's `end` is taken from its first entry only, so `end` on a later entry of the group is dropped
- where: packages/labkit/src/chrome/regions/groupsOf.ts:27 (groupsOf)
- scenario: the bucket's `end` is set when the group is created (`end: c.end ?? false`) and never updated. A lab adds `{ id: 'share', region: 'toolbar', group: 'view', end: true, item }` to sit with the loupe controls at the far end; the built-in `loupe` opened the `view` group with no `end`, so `share`'s `end` is silently ignored and the whole group stays at the near end. Conversely a `start: true` contribution in group `trial` with no `end` (which `mergeContributions` moves ahead of the built-ins) opens the `trial` group unmarked and drags Export and Load snapshot off the far end. `ContributionBase.end` promises it pushes "this contribution, and its group".
- evidence: read
- severity: low

## The palette and viewport regions silently drop `end` (and the viewport drops `group`)
- where: packages/labkit/src/chrome/regions/PaletteRegion.tsx:22 (PaletteRegion), packages/labkit/src/chrome/regions/ViewportRegion.tsx:28 (ViewportRegion)
- scenario: `ContributionBase` offers every contribution `group` and `end` ("Pushes this contribution, and its group, to the far end of the region"), and the type lets any `palette` or `viewport` contribution set them. PaletteRegion maps each contribution to a `ToolRailItem`, which has no `end`, so `{ region: 'palette', end: true }` sits in declaration order. ViewportRegion reads neither: the built-in zoom controls declare `group: 'zoom'`, but a consumer's viewport control in its own group is laid out inline with them, and `end: true` does nothing. The option is accepted and ignored on these paths, where the toolbar and status regions honor it.
- evidence: read
- severity: low

## Files read
packages/labkit/src/chrome/ChromeRegions.stories.tsx
packages/labkit/src/chrome/LabChrome.tsx
packages/labkit/src/chrome/builtins.tsx
packages/labkit/src/chrome/index.ts
packages/labkit/src/chrome/labTypes.ts
packages/labkit/src/chrome/merge.ts
packages/labkit/src/chrome/regions/OverlayRegion.tsx
packages/labkit/src/chrome/regions/PaletteRegion.less
packages/labkit/src/chrome/regions/PaletteRegion.tsx
packages/labkit/src/chrome/regions/SidebarPanes.stories.tsx
packages/labkit/src/chrome/regions/SidebarPanes.tsx
packages/labkit/src/chrome/regions/SidebarRegion.less
packages/labkit/src/chrome/regions/SidebarRegion.stories.tsx
packages/labkit/src/chrome/regions/SidebarRegion.tsx
packages/labkit/src/chrome/regions/StatusRegion.tsx
packages/labkit/src/chrome/regions/TitleBarRegion.tsx
packages/labkit/src/chrome/regions/ToolbarRegion.tsx
packages/labkit/src/chrome/regions/ViewportRegion.less
packages/labkit/src/chrome/regions/ViewportRegion.tsx
packages/labkit/src/chrome/regions/groupsOf.ts
packages/labkit/src/chrome/trialActions.tsx
packages/labkit/src/chrome/types.ts

<!-- done: 4 findings, files read: 22 -->

I wrote the first five findings to `.skulk/out/findings.md`, but permission to add the last finding and the closing sections was denied. The complete document is below.

# labkit.chrome — blind review, round 50

## The built-in FPS meter's `end: true` drags every instrument status readout to the far end
- where: packages/labkit/src/chrome/regions/StatusRegion.tsx:25 (StatusRegion), with packages/labkit/src/chrome/builtins.tsx:199 (zoomContributions)
- scenario: a canvas instrument declares `chrome: [{ id: 'count', region: 'status', item: { text: '12 nodes' } }]` with no `end`. `useTrialContributions` merges the built-ins first, so the list is `scale, fps(end), count`. StatusRegion puts the spacer before the first `end` readout and lays out "every one after it" at the far end. So `count` renders right of the FPS meter, at the far edge, though it never asked to go there. Only canvas trials get `fps`, so the same readout lands at opposite ends depending on the instrument kind. Expected: a readout without `end` sits with the leading readouts.
- evidence: read
- severity: medium

## `group` and `end` mean different things in each region; four regions ignore `group` entirely
- where: packages/labkit/src/chrome/types.ts:121 (ContributionBase docs); packages/labkit/src/chrome/regions/ViewportRegion.tsx:28, TitleBarRegion.tsx:68, StatusRegion.tsx:28, SidebarRegion.tsx:112
- scenario: `ContributionBase` promises "groups sort by first appearance; items sort within a group by declaration order", and says `end` "pushes this contribution, and its group, to the far end". Only ToolbarRegion (through `groupsOf`) and PaletteRegion (through ToolRail) group.
  - `{ id: 'fit', region: 'viewport', group: 'zoom', … }` renders after the zoom slider, not beside the zoom buttons.
  - A status readout with `group: 'view'` does not join `scale`.
  - A title-bar item's `group` is dropped.
  - `end` is a per-item split in TitleBarRegion, a "first end and everything after" spacer in StatusRegion, and a per-group flag in ToolbarRegion. ViewportRegion, SidebarRegion, and PaletteRegion ignore it.
- evidence: read
- severity: medium

## A group's `end` is taken from its first member only
- where: packages/labkit/src/chrome/regions/groupsOf.ts:27 (groupsOf)
- scenario: the built-ins `loupe`, `eyedropper`, and `picked-color` form toolbar group `view` with no `end`. A trial adds `{ id: 'grid', region: 'toolbar', group: 'view', end: true, … }`. The group takes its `end` from its first member, so the later `end: true` is silently dropped. The same goes for a later `end: false` added to group `trial` after the built-in `export`: it is overridden. Each time, `end` contradicts its documented effect.
- evidence: read
- severity: low

## Lab header items with `keys` lose their declared `shortcut` when no command is found
- where: packages/labkit/src/chrome/LabChrome.tsx:109 (useBoundShortcuts)
- scenario: a header item declares both `keys` and `shortcut`. `useBoundShortcuts` always strips `shortcut`, then adds the bound key only if `registry.list()` holds `lab.item.<id>`. With no `<ActionsProvider>` (`useActionsRegistry()` returns null, so the list is `NO_ACTIONS`), or before the command registers, the tooltip shows no key at all. Expected: fall back to the declared `shortcut`.
- evidence: read
- severity: low

## Ungrouped toolbar entries are announced by their contribution id
- where: packages/labkit/src/chrome/regions/ToolbarRegion.tsx:96 (ToolbarRegion)
- scenario: an ungrouped contribution gets a bucket whose `key` is its id, and `Bar.Group` gets `aria-label={g.key}`. So `{ id: 'btn-x9', region: 'toolbar', item: … }` is read out by a screen reader as group "btn-x9". Group keys such as `history` are internal names, not labels, too.
- evidence: read
- severity: low

## A tool whose key was unbound still shows its declared key on the trial rail
- where: packages/labkit/src/chrome/builtins.tsx:95 (shownKey)
- scenario: a weasel-scene instrument declares tool `draw` with `shortcut: { key: 'D' }` and reports its live keys through `setToolShortcuts`. The user unbinds `D` from `tool.activate`. `toolShortcutsOf` leaves out a tool with no keys, so the report has no `draw` entry. `shownKey` reads that absence as "not reported" and falls back to `t.shortcut`, so the rail tooltip still offers `D`, which now does nothing.
- evidence: read (the rail outcome is inferred from the two sources, not run)
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

<!-- done: 6 findings, files read: 22 -->
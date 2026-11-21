# Audit round 60 — ui.components.part6

## Alt+Left/Right inside a tab's rename field moves the page instead of the caret
- where: packages/ui/src/components/PageTabs/usePageTabs.tsx:103 (onKeyDownCapture)
- scenario: double-press a tab to rename it, then press Option+Left (macOS word-left) in the field. The strip's
  `onKeyDownCapture` runs before the input's own `onKeyDown` (which only stops bubbling); `target.closest('[role="tab"]')`
  finds the tab around the input, `nudgeOf` sees Alt+ArrowLeft, and the handler calls `preventDefault` and
  `drag.nudge(...)`: the caret does not move and the page is reordered mid-rename. The handler should ignore keys whose
  target is the rename field (or any editable element), as it does presses (`editing !== page.id` guards pointerdown).
- evidence: read (nudgeOf → isNudgeChord is `altKey && !ctrl && !meta`, packages/ui-input/src/reorder.ts:91)
- severity: medium

## A rename cut off by a hold reopens when the hold lifts
- where: packages/ui/src/components/PageTabs/usePageTabs.tsx:129 (tabs map) / :46 (editing state)
- scenario: a tab is being renamed and the strip becomes disabled/read-only (scope or prop). `onRename` turns
  `undefined`, so the `RenameField` unmounts without calling `onDone`, but `editing` keeps the page id. When the hold
  lifts, the field remounts, focuses and selects itself, with the edit the user never resumed. `editing` should be
  cleared when renaming stops being possible.
- evidence: read
- severity: low

## A bar cell's source answers a sibling leaf without its default, unlike every other params surface
- where: packages/ui/src/components/PrefsBar/PrefsBar.tsx:155 (leafCell)
- scenario: a `PrefsBar` schema holds `fontFamily` beside `fontWeight` (default 700), and `values` has no
  `fontWeight` entry. Each cell's `ctx.source` is `createRecordSource({ [path]: leaf }, values, …)`, a one-leaf
  source whose `valueAt` returns `getOwn(values, path)` raw — no schema, no default. `leafField`
  (Prefs/leafField.ts:29) reads `ctx.source.valueAt('…fontWeight')` for the family picker's probe and gets `undefined`,
  so it probes at 400/normal; the same schema in `Prefs` (a `createValuesSource` over the schema) reads 700. The same
  holds for the cell's own path: `ctx.value` is the default but `ctx.source.valueAt(path).value` is `undefined`, so a
  custom renderer reading the source sees a different value than the one it is handed. The bar's source should be
  built over the bar's schema (it already has `barReader` for exactly this).
- evidence: read (createRecordSource, packages/prefs/src/sources/valuesSource.ts:88)
- severity: medium

## An image read that finishes after the picker is held still commits
- where: packages/ui/src/components/PatternPicker/PatternPicker.tsx:152 (upload)
- scenario: pick a large image file, then the picker turns disabled/read-only (scope or prop) before `readImage`
  resolves. The `.then` closure calls the `onChange` gated at the render the file was picked in, when the hold let it
  through, so the image paint is committed into a held control. Nothing about a hold retires the pending read
  (`reading.drop()` runs only on a tile pick or unmount). The commit should go through the current gate (e.g. a ref
  to the latest gated `onChange`, as `latest` does for `value`).
- evidence: read
- severity: low

## The size bar lights "M" for a texture paint, and pressing any size does nothing
- where: packages/ui/src/components/PatternPicker/PatternPicker.tsx:215 / :158 (resize)
- scenario: `value` is a `texture` pattern (neither tile nor image). `size` falls back to `DEFAULT_TILE_SIZE`, so the
  bar shows 8 ("M") selected, but `resize` has neither `tile` nor `image` and drops the press silently. The bar should
  light nothing (or be held) for a paint it cannot resize.
- evidence: read
- severity: low

## A Powerline segment takes a stale left cap from a child that no longer reports one
- where: packages/ui/src/components/Powerline/slot.ts:46 (usePowerlineSegment) / Powerline.tsx:47 (caps)
- scenario: `caps` is only ever written, never cleared. Row `[A endCap="arrow", B]`, then A is replaced at index 0 by a
  child that does not call `usePowerlineSegment` (plain text, or a component rendering null). `caps[0]` keeps
  `'arrow'`, so B still draws an arrow-notched left edge against a neighbor that has none, instead of `'flat'`. A
  segment's report should be withdrawn on unmount (layout-effect cleanup) so its index reads `'flat'` again.
- evidence: read
- severity: low

## With `over` a `PrefSection`, aliases inside a bar's menu group resolve against the wrong schema and vanish
- where: packages/ui/src/components/PrefsBar/PrefsBar.tsx:71 (PrefsBar, `menu`)
- scenario: `over` is typed and documented as `PrefGroup | PrefSection`, and the bar's own alias cells resolve through
  `over = overProp ?? schema`. The menu sources instead take `overProp && 'children' in overProp ? overProp : schema`,
  so a section `over` falls back to the bar's own schema. A group `as: 'menu'` holding `alias` leaves into that section
  then runs `prefAliasTarget(alias, p => prefLeafAt(src.over ?? root, p))` (routing/src/menus/resolveMenu.ts:191) in
  the bar's schema, finds nothing, and returns no rows: the same alias that draws as a cell on the line is missing
  from the menu. `prefLeafAt` handles sections; only `BarMenuSources.over`'s `PrefGroup` type forces the fallback.
- evidence: read
- severity: low

## An SVG with no width/height is stored square, losing its viewBox aspect
- where: packages/ui/src/components/PatternPicker/readImageFile.ts:38 (readImageFile)
- scenario: upload an SVG that declares only `viewBox="0 0 200 100"`. An `<img>` of it has no intrinsic size, so
  `naturalWidth`/`naturalHeight` can read 0 (Firefox does; inference for other engines), and `|| 1` turns both into 1.
  `seedImagePattern` then sizes the tile 128×128 and the picture is stretched to a square. The SVG's aspect ratio
  should be read (e.g. from its viewBox, or by drawing at a known width) rather than defaulted to 1:1.
- evidence: inference (engine behavior for size-less SVG not run here)
- severity: low

## Files read
packages/ui/src/components/PageTabs/PageTabs.tsx
packages/ui/src/components/PageTabs/PageTabsAlong.tsx
packages/ui/src/components/PageTabs/RenameField.tsx
packages/ui/src/components/PageTabs/index.ts
packages/ui/src/components/PageTabs/usePageTabs.tsx
packages/ui/src/components/PaintField/PaintEditorPopover.tsx
packages/ui/src/components/PaintField/PaintField.module.css
packages/ui/src/components/PaintField/PaintField.stories.module.css
packages/ui/src/components/PaintField/PaintField.stories.tsx
packages/ui/src/components/PaintField/PaintField.tsx
packages/ui/src/components/PaintField/index.ts
packages/ui/src/components/PaintInput/PaintInput.module.css
packages/ui/src/components/PaintInput/PaintInput.stories.tsx
packages/ui/src/components/PaintInput/PaintInput.tsx
packages/ui/src/components/PaintInput/index.ts
packages/ui/src/components/PaintInput/paintKindEditor.tsx
packages/ui/src/components/PatternPicker/PatternPicker.module.css
packages/ui/src/components/PatternPicker/PatternPicker.stories.tsx
packages/ui/src/components/PatternPicker/PatternPicker.tsx
packages/ui/src/components/PatternPicker/index.ts
packages/ui/src/components/PatternPicker/readImageFile.ts
packages/ui/src/components/Plot2D/Plot2D.module.css
packages/ui/src/components/Plot2D/Plot2D.stories.tsx
packages/ui/src/components/Plot2D/Plot2D.tsx
packages/ui/src/components/Plot2D/PlotFrame.tsx
packages/ui/src/components/Plot2D/PlotTicks.tsx
packages/ui/src/components/Plot2D/geometry.ts
packages/ui/src/components/Plot2D/index.ts
packages/ui/src/components/Popover/Popover.module.css
packages/ui/src/components/Popover/Popover.stories.module.css
packages/ui/src/components/Popover/Popover.stories.tsx
packages/ui/src/components/Popover/Popover.tsx
packages/ui/src/components/Popover/PopoverDialog.tsx
packages/ui/src/components/Popover/index.ts
packages/ui/src/components/Powerline/Powerline.module.css
packages/ui/src/components/Powerline/Powerline.stories.tsx
packages/ui/src/components/Powerline/Powerline.tsx
packages/ui/src/components/Powerline/index.ts
packages/ui/src/components/Powerline/slot.ts
packages/ui/src/components/PrefsBar/PrefsBar.stories.module.css
packages/ui/src/components/PrefsBar/PrefsBar.stories.tsx
packages/ui/src/components/PrefsBar/PrefsBar.tsx
packages/ui/src/components/PrefsBar/barCells.tsx
packages/ui/src/components/PrefsBar/barNodes.tsx
packages/ui/src/components/PrefsBar/index.ts
packages/ui/src/components/PrefsSource/PrefsSource.tsx

<!-- done: 8 findings, files read: 46 -->

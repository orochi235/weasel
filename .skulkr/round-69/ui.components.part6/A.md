# Audit round 69 — ui.components.part6

## PatternPicker drops the paint's opacity (and the image's) on a tile pick or an image upload
- where: packages/ui/src/components/PatternPicker/PatternPicker.tsx:142 (pick), :156 (upload)
- scenario: inside PaintInput a hatch pattern is set to 40% with the opacity slider PaintInput draws under the picker (`paintWithAlpha` writes `opacity`). Clicking the "dots" swatch commits `withTransform(seedPattern('dots', color, size))`, which carries over only `transform`; `seedTile` builds `{ kind, color, units }`, so `opacity` is gone and the fill jumps to 100%. Same for an uploaded image (`seedImagePattern`). Rotation and resize spread the existing paint and keep it, so the picker answers "what survives a change" two ways. Should carry `opacity` across like `transform` (as `withPaintKind` does for gradients).
- evidence: read (seedTile in packages/paint-kinds/src/paintKinds.ts:74, paintWithAlpha in packages/paint/src/paintDefaults.ts:113)
- severity: medium

## Page strips mark a drop in the gap just after the dragged tab, where releasing does nothing
- where: packages/ui/src/components/PageTabs/usePageTabs.tsx:109-110 (tab classes); packages/ui/src/components/PageTabs/PageTabsAlong.tsx:96 (dropAt)
- scenario: drag tab "b" (index 1 of a,b,c) a little right so the gap resolves to 2 (before "c"). `useReorderDragList` publishes `targetIndex: 2`; usePageTabs only suppresses the mark when the tab *at* the target is dragged, so "c" gets `dropBefore`, and `dropAt` returns a position for the Along variant. On release `isNoopDrop` (useReorderDragList.ts:265) treats gap 2 as no move and `onMove` never fires. Likewise dragging the last tab rightward gives target = pages.length → `dropAfter` on the dragged tab itself. The mark should be withheld for every gap `isNoopDrop` rejects (both ends of the dragged run), not only the one before it; the comment on `dropAt` claims only "a target before a dragged tab is its own place".
- evidence: read (useReorderDragList.ts:256-267, ui-input reorder.ts isNoopDrop)
- severity: low

## Files read
packages/ui/src/components/PageTabs/PageTabs.stories.tsx
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

<!-- done: 2 findings, files read: 46 -->

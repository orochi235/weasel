## Renaming a page to an empty or all-space name commits `''`, leaving a blank tab with no accessible name
- where: packages/ui/src/components/PageTabs/RenameField.tsx:16-19 (RenameField `finish`)
- scenario: double-press a tab, clear the field (or type only spaces), press Enter. `name` is `''` after `trim()`, which is `!== initial`, so `onDone('')` → `usePageTabs` `commit` → `onRename(id, '')`. core's `pageName` is `page.name ?? \`Page ${i+1}\``, so `''` is kept as the name and the tab draws an empty label and has no accessible name (the story's own `onRename` shows this). An empty name should be treated as abandoned (`null`) or as "unnamed" (go back to the numbered label), not stored as `''`.
- evidence: read (RenameField.tsx:16-19, usePageTabs.tsx:92-95, packages/core/src/core/pages/pages.ts:85-87)
- severity: medium

## A drag that would drop a tab just after itself shows a drop mark, and the release does nothing
- where: packages/ui/src/components/PageTabs/usePageTabs.tsx:109-110 (tab classes); packages/ui/src/components/PageTabs/PageTabsAlong.tsx:99-106 (`dropAt`)
- scenario: drag tab `d` a little toward its end so that `targetIndex` becomes `d + 1` (the pointer passes its own midpoint), or drag the last tab so that `targetIndex === pages.length`. On a straight strip, tab `d+1` gets `s.dropBefore` (or the last tab gets `s.dropAfter` even though it is the one being dragged). Along a run, `dropAt` returns a mark, because it only rules out a target *before* a dragged tab. But `isNoopDrop` (ui-input/reorder.ts:36-42) counts both `gap == first` and `gap == last + 1` as the block's own place, so `onReorder` never fires. The strip marks a drop that it will not do. Gap `d` gets no mark, so the two sides of the dragged tab disagree.
- evidence: read (usePageTabs.tsx:106-110, PageTabsAlong.tsx:96-107, useReorderDragList.ts:263-267, ui-input/src/reorder.ts:36-42)
- severity: low

## With no value or a mixed one, PaintInput's body writes a solid even when `kinds` leaves out `solid`
- where: packages/ui/src/components/PaintInput/PaintInput.tsx:268-277 (PaintBody `renderBody`)
- scenario: `<PaintInput kinds={['linear-gradient','radial-gradient']} mixed value={undefined} …/>` (or the same through `PaintField`, which passes `kinds` on). The kind bar offers only gradients, but the body is always a `ColorField`, and picking a color calls `onChange(solidFromField(color))`. A consumer that restricted the control to gradients gets a solid paint. The `kinds` restriction is enforced in the bar and silently dropped on this path.
- evidence: read
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

<!-- done: 3 findings, files read: 46 -->

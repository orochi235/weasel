# Audit round 60 — ui.components.part6

Note: the tree checked out is 6f634fabe1; commit deaf03bd8ed4… is not present in this repository, so line numbers are against 6f634fabe1.

## Alt+Left/Right while renaming a page tab moves the tab instead of the caret
- where: packages/ui/src/components/PageTabs/usePageTabs.tsx:103 (onKeyDownCapture)
- scenario: double-press a tab to rename it, then press Alt+ArrowLeft in the field (word-left on macOS). The strip's capture-phase handler runs before RenameField's own onKeyDown; `e.target.closest('[role="tab"]')` finds the tab around the input, `nudgeOf` returns -1, so it calls `preventDefault`/`stopPropagation` and `drag.nudge` — the page is reordered and the caret never moves. It should ignore keys whose target is inside the rename field (the activation check on line 109 already requires `e.target === tab`; the nudge path does not).
- evidence: read
- severity: medium

## An image upload in PatternPicker commits through the hold and `onChange` of the render that started it
- where: packages/ui/src/components/PatternPicker/PatternPicker.tsx:146 (upload)
- scenario: `onChange` is `hold.gate(props.onChange)` evaluated at render, and the `readImage(...).then` closure keeps that render's copy. Pick a large image (the read decodes and re-encodes it, so it takes a while), and before it resolves either (a) the picker turns `disabled`/`readOnly` — the stale ungated `onChange` still commits the image, though the props say nothing commits while held; or (b) the parent re-renders with a new `onChange` (another node selected, same pattern kind so the picker stays mounted) — the paint is built from `latest.current` (the new value's transform) but handed to the old node's handler. Only a later pick or unmount retires the read. The resolve should read the current hold and `onChange` through a ref, as it already does for `value`.
- evidence: read
- severity: medium

## PatternPicker's size bar lights "M" for a `texture` paint and its presses do nothing
- where: packages/ui/src/components/PatternPicker/PatternPicker.tsx:158 (resize), :215
- scenario: value is a pattern paint that is neither a tile nor an image (a `texture` paint, which the code comments say shows no tile selected). `size` falls back to `DEFAULT_TILE_SIZE`, so the Tile size bar shows "M" lit as if the paint had that size; pressing S/L/XL calls `resize`, which matches neither branch and silently drops the choice. The bar should light nothing (and be inert) when the paint has no size to edit.
- evidence: read
- severity: low

## Plot2D maps client points with independent x/y scales, but the SVG draws with uniform `meet` scaling
- where: packages/ui/src/components/Plot2D/geometry.ts:59 (clientToPlotPoint)
- scenario: the svg has `viewBox="0 0 width height"` and the default `preserveAspectRatio` (xMidYMid meet). If CSS sizes it non-uniformly — `style`/`className` give it `width: 100%` at a fixed height, which the doc comment says the mapping is built to handle — the content is scaled uniformly and centered with letterbox margins. `clientToPlotPoint` instead divides by `rect.width` and `rect.height` separately from the rect's top-left, so a press on a drawn mark maps to a different plot/model point (wrong `onPointerDown`/`onContextMenu` coords and `clientToModel` during drags). Either set `preserveAspectRatio="none"` or map through `getScreenCTM()`.
- evidence: read
- severity: low

## A curved PageTabs draws a drop marker at the dragged tab's own slot, where the straight strip draws none
- where: packages/ui/src/components/PageTabs/PageTabsAlong.tsx:92 (dropAt)
- scenario: drag a tab and hold it over its own place, so `targetIndex` equals the dragged tab's index (a no-op move). The straight strip skips `dropBefore` for that tab (usePageTabs.tsx:119, `!draggedIds?.includes(page.id)`), so no marker shows; `dropAt` has no such check and `TabRule` draws a drop line before the dragged tab. One question — does a drop at the dragged tab's own slot get a marker — is answered two ways by the two layouts. `dropAt` should get the dragged ids and return `null` in the same case.
- evidence: read
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

<!-- done: 5 findings, files read: 46 -->

# Audit round 64 — ui.components.part4

## InlineRange's Escape cancels a drag but lets the same Escape close the popover or dialog it sits in
- where: packages/ui/src/components/InlineRange/useRangeEdit.ts:93 (useRangeEdit, onKey)
- scenario: an `InlineRange` in a `Callout`/RAC popover or dialog; the user drags the thumb and presses Escape. `onKey` is a bubble-phase listener on the input that only calls `preventDefault()`, so the keydown carries on to the overlay's Escape handler (RAC's `useOverlay` does not check `defaultPrevented`) and the overlay closes too. The kit has already ruled the other way for every other drag: `startThresholdDrag` (routing/thresholdDrag.ts:73, "the Escape that ends a drag must not also close the dialog the drag is in") and `segmentSweep` (Segmented/segmentSweep.tsx:109, "stops it there as a drag's does") both listen on window in the capture phase and call `stopPropagation()`. Expected: Escape cancels the drag and nothing else.
- evidence: read
- severity: medium

## A range held (disabled or read-only) mid-drag still commits the drag on release
- where: packages/ui/src/components/InlineRange/useRangeEdit.ts:75 (useRangeEdit, onRelease / onBlur)
- scenario: the user is dragging an `InlineRange` (edit open, `last` = 70) when the host sets `disabled` or `readOnly` (a lock from a collaborator, a mode switch, a `Disabled` scope opening). `onInput` and `onChange` check `live.current.refuses` and go quiet, but `onRelease` and `onBlur` call `commit()` with no such check, so the pointerup sends `onValueChange(70)` from a control that is now held. The component doc says a held range "drops every input". Expected: an edit the hold catches open is canceled (`cancel(edit)`), not committed.
- evidence: read
- severity: low

## iconFromData throws in development on a value JSON can't stringify, where it promises to read it as none
- where: packages/ui/src/components/Icon/iconFromData.ts:13 (iconFromData)
- scenario: `resolveIcon(source: unknown)` and `iconFromData(value: unknown)` say "anything else reads as none, and warns". The warning text is built with `JSON.stringify(value)`, which throws for a BigInt (`iconFromData(1n)`) and for a cyclic object, for example a React element created during render (`icon: <MyGlyph />` from a caller still on the old ReactNode icon shape: in React's dev build its `_owner` is a Fiber, which is cyclic). So in dev the render that resolves the icon throws `TypeError` instead of drawing nothing. In production the same value resolves to `undefined`. Expected: the warning formats the value without throwing (a try/catch, or `String(value)` as the fallback).
- evidence: read
- severity: low

## ItemList draws `—` for `empty={null}` while its measure reads an empty string
- where: packages/ui/src/components/ItemList/domItemList.tsx:25 (itemListFaceOf); ItemList.tsx:157
- scenario: `domItemList` with `rows: []` and `empty: null` (or `false`). `draw` renders `ItemList`, which shows `empty ?? '—'`, so a dash. `itemListFaceOf` tests `empty !== undefined`, so it passes `nodeText(null)` = `''` as the face's empty text, and `measureRowList` measures an empty string, not the `'—'` it uses by default. The measured width/baseline differ from what is drawn. One empty-state decision is answered two ways. Expected: both sides treat null the same way (draw nothing for `null`, or use `== null` in both).
- evidence: read
- severity: low

## useFloatingPlacement shows a stale dropped position again when `placement` returns to the object a drag started from
- where: packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts:100 (useFloatingPlacement, `shown`)
- scenario: the host keeps a stable default, `const HOME = { x: 0, y: 0, anchor: 'bottom-left' }`, as `placement`. The user drags the panel and releases: `live = { at: A, over: HOME, dragging: false }`, and the host commits `A`, so `placement !== over` and the panel shows `A`. Later the host resets (a "Reset layout" command, an undo, a prefs reset) by setting `placement` back to `HOME`. `live` was never cleared (only the next press or a cancel clears it), so `live.over === placement` is true again and `shown` is `live.at` = A. The panel stays where it was dropped while the host says HOME, until the user next presses it. The doc says the hold lasts "until `placement` moves off that one"; it actually comes back whenever `placement` returns to that object. Expected: once `placement` changes away from `over`, `live` is dropped for good (for example, clear it in an effect when `placement !== live.over` and the drag is not live). `useEditDraft` (packages/ui/src/useEditDraft.ts:38) already rules it this way: "A value that moved ends the draft, so the value coming back to where the draft began does not revive it."
- evidence: read
- severity: medium

## Files read
packages/ui/src/components/FloatingPanel/dragPlacement.ts
packages/ui/src/components/FloatingPanel/index.ts
packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts
packages/ui/src/components/FontOptions/fontOptions.ts
packages/ui/src/components/FontOptions/index.ts
packages/ui/src/components/Foundations/Foundations.module.css
packages/ui/src/components/Foundations/Foundations.stories.tsx
packages/ui/src/components/FpsMeter/FpsMeter.module.css
packages/ui/src/components/FpsMeter/FpsMeter.stories.tsx
packages/ui/src/components/FpsMeter/FpsMeter.tsx
packages/ui/src/components/FpsMeter/fpsAverage.ts
packages/ui/src/components/FpsMeter/index.ts
packages/ui/src/components/HistoryList/HistoryList.module.css
packages/ui/src/components/HistoryList/HistoryList.stories.tsx
packages/ui/src/components/HistoryList/HistoryList.tsx
packages/ui/src/components/HistoryList/index.ts
packages/ui/src/components/Icon/Icon.gallery.stories.module.css
packages/ui/src/components/Icon/Icon.gallery.stories.tsx
packages/ui/src/components/Icon/Icon.tsx
packages/ui/src/components/Icon/actionIcon.ts
packages/ui/src/components/Icon/iconFromData.ts
packages/ui/src/components/Icon/index.ts
packages/ui/src/components/Icon/layers.ts
packages/ui/src/components/Icon/placeholder.ts
packages/ui/src/components/Icon/resolveIcon.tsx
packages/ui/src/components/InlineMarkdown/InlineMarkdown.stories.tsx
packages/ui/src/components/InlineMarkdown/InlineMarkdown.tsx
packages/ui/src/components/InlineMarkdown/index.ts
packages/ui/src/components/InlineMarkdown/parseInline.ts
packages/ui/src/components/InlineRange/InlineRange.module.css
packages/ui/src/components/InlineRange/InlineRange.stories.module.css
packages/ui/src/components/InlineRange/InlineRange.stories.tsx
packages/ui/src/components/InlineRange/InlineRange.tsx
packages/ui/src/components/InlineRange/index.ts
packages/ui/src/components/InlineRange/useRangeEdit.ts
packages/ui/src/components/Input/Input.module.css
packages/ui/src/components/Input/Input.stories.module.css
packages/ui/src/components/Input/Input.stories.tsx
packages/ui/src/components/Input/Input.tsx
packages/ui/src/components/Input/index.ts
packages/ui/src/components/ItemList/ItemList.module.css
packages/ui/src/components/ItemList/ItemList.stories.module.css
packages/ui/src/components/ItemList/ItemList.stories.tsx
packages/ui/src/components/ItemList/ItemList.tsx
packages/ui/src/components/ItemList/domItemList.tsx
packages/ui/src/components/ItemList/index.ts

<!-- done: 5 findings, files read: 46 -->


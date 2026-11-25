# Findings: ui.components.GradientEditor (round 67)

## Under a `ReadOnly` scope, Delete/Backspace on a stop handle and the Remove button still remove a stop
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:79 (`removable`), :114 (track `onKeyDown`), :162 (`onRemove`)
- scenario: `<ReadOnly reason="Locked"><GradientEditor value={g3stops} onChange={…}/></ReadOnly>`. The Slider refuses its own drags and key steps under read-only (`useSliderHold` → `useControlHold`), and with a reason the handles stay focusable. Focus a handle, press Delete: GradientStops' own keydown handler calls `remove(index, true)` → `commit(...)` → `onChange` with a stop removed. Likewise the StopEditor's Remove button (`Button` reads no hold scope; `disabled={!removable}`, and `removable` checks only `props.disabled`) commits a removal. Expected: read-only refuses every change, as the Slider and fields do. `removable` should account for read-only (e.g. via `useControlAccess`), and `GradientEditor` only reads `useDisabled`, so it never learns of the read-only state to pass down.
- evidence: read (GradientStops.tsx, StopEditor.tsx, Slider/types.ts:150, Button/Button.tsx has no Disabled/ReadOnly hook)
- severity: medium

## Held (disabled/read-only) GradientHandles overlay still reports `onInput(start)` and `onCancel` on an Escaped drag
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:132-150 (`DragPoint`)
- scenario: `<GradientHandles readOnly readOnlyReason="…" …/>`. `onDrag` is gated to a no-op, but the `useHandleDrag` handlers are spread unconditionally: pressing a handle runs `session.begin()`, each move sets `sent.current = true` before calling the gated (no-op) `onDrag`, and Escape runs `session.cancel(true)`, which calls the consumer's `onInput(startValue)` and `onCancel()`. A held overlay that sent nothing tells the consumer an edit was previewed and canceled (a consumer that opens/closes an undo transaction or a live-preview session on these callbacks reacts to an edit that never happened). Expected: a held point reports nothing; `sent` should only be set when the move actually emitted.
- evidence: read
- severity: low

## Removing a stop moves the selection before the commit, so a caller that declines the removal is left on a different stop
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:81-89 (`removed`/`remove`), :138-141 (`onRemoveThumb`); useStopSelection.ts:38-45 (`removing`)
- scenario: stops [A@0, B@0.5, C@1], C (index 2) selected. Right-click A's handle (Slider context-menu remove, which does not focus A). `removed(0)` → `removing(0)` computes `next = 1` and calls `select(1)` immediately (setOwn + `onSelectionChange(1)`), then commits. A controlled caller that rejects the edit (locked node, validation) keeps all three stops, but the selection is now B, not C. `useFocusAfterCommit` was written so a declined edit leaves nothing behind for focus; the selection shift has no such guard and fires on the uncommitted removal.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/GradientEditor/GradientEditor.module.css
packages/ui/src/components/GradientEditor/GradientEditor.stories.tsx
packages/ui/src/components/GradientEditor/GradientEditor.tsx
packages/ui/src/components/GradientEditor/GradientHandles.stories.module.css
packages/ui/src/components/GradientEditor/GradientHandles.stories.tsx
packages/ui/src/components/GradientEditor/GradientHandles.tsx
packages/ui/src/components/GradientEditor/GradientStops.module.css
packages/ui/src/components/GradientEditor/GradientStops.tsx
packages/ui/src/components/GradientEditor/StopEditor.tsx
packages/ui/src/components/GradientEditor/handleOverlay.module.css
packages/ui/src/components/GradientEditor/handleOverlay.tsx
packages/ui/src/components/GradientEditor/index.ts
packages/ui/src/components/GradientEditor/useFocusAfterCommit.ts
packages/ui/src/components/GradientEditor/useStopSelection.ts

<!-- done: 3 findings, files read: 14 -->

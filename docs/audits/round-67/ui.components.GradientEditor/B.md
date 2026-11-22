## A held (disabled/read-only) overlay still sends onInput and onCancel when a drag on it is canceled
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:137-150 (DragPoint)
- scenario: `<GradientHandles disabled>` (or read-only through a hold scope). `hold.gate` turns `onDrag` into a no-op, but `onStart` still calls `session.begin()` and `onMove` still sets `sent.current = true`. Press a handle, move, press Escape (or lose the pointer). `session.cancel(true)` then calls `onInput(start.value)` and `onCancel()` on the consumer, even though the held overlay never sent an edit. What should happen: a held overlay reports nothing, the same way `gate` suppresses `onDrag`. `sent` should only be set when the gated handler actually ran, or the session calls should be gated as well.
- evidence: read (controlHold.tsx:88: `gate` returns `ignore` while refusing; session calls are not gated)
- severity: low

## An arrow key pressed during a pointer drag overwrites the drag's start, so canceling the drag afterwards doesn't restore the value
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:153-164 (DragPoint onKeyDown), :54-65 (useOverlayEdit emit/session)
- scenario: The consumer passes `onInput`. The user drags a handle, so `begin` stores value V0 and `onInput` moves the consumer to V1. While still holding the pointer, they press an arrow key on the focused circle. `session.begin()` overwrites `from` with V1. The keyboard commit then sets `from.current = null`. When the user presses Escape on the drag, `session.cancel(true)` finds no start, so it never sends `onInput(V0)`. Only `onCancel()` fires, and the consumer's preview stays at V1 or later. What should happen: Escape restores V0, or the arrow key is ignored while a drag is running.
- evidence: read
- severity: low

## Removing a stop moves the selection before the commit, so a declined removal leaves the selection on a different stop
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:81-88 (removed/remove), :138-142 (onRemoveThumb); packages/ui/src/components/GradientEditor/useStopSelection.ts:38-45 (removing)
- scenario: A controlled `GradientEditor` whose `onChange` rejects the edit (it keeps `value` as it is, for example a validation veto). The user has stop index 2 of 3 selected and presses Delete. `removing(2)` calls `select(1)` and `onSelectionChange(1)` before `commit` runs. The commit is declined and the list still has 3 stops, but the editor and any shared handles are now on stop 1. What should happen: the selection only moves once the shorter list arrives. `useFocusAfterCommit` already guards the focus half of this against a declined edit; the selection half has no such guard.
- evidence: read
- severity: low

## Removing the selected stop when it is first along the gradient at stored index 0 does not fire onSelectionChange
- where: packages/ui/src/components/GradientEditor/useStopSelection.ts:33, :41-43 (select/removing)
- scenario: Stops `[A@0, B@0.5, C@1]`, with A (index 0) selected. Removing it makes `keep = order[1] = 1`, so `next = 0`. `select(0)` returns early because `index === asked`. `onSelectionChange` never fires, even though the selected stop changed from A to B. `GradientEditorProps.onSelectionChange` is documented to fire when "the selected one [is] removed", and that is the case here. The early return should compare stop identity, or `removing` should always notify.
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

<!-- done: 4 findings, files read: 14 -->

I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below.

# Audit round 60: ui.components.part7

## ResizeHandle commits through `onChange` a size it never sent through `onInput`
- where: packages/ui/src/components/ResizeHandle/ResizeHandle.tsx:121 (ResizeHandle, `onEnd` of the pointer session)
- scenario: `onEnd` calls `finish(valueAt(axisOf(ev)))`. That recomputes the size from the end event's own coordinates and hands it only to `onChange`. The end event's position can differ from the last move's:
  - a pen or touch lift can report its pointerup somewhere new;
  - `openPointerSession` ends a session on a move with no buttons held (`isMissedRelease`) and passes that move as the end event, with no `onMove` before it;
  - a press with no move at all ends with `settle(value)`, which differs from `value` when `value` is off the step grid or outside `[min, max]`.

  The consumer drives the live pane from `onInput`, as the doc says to. In each case the pane stays at the last `onInput` size while `onChange` persists a different one. The fix is to send the end value through `onInput` when it differs from `drag.last`, or to commit `drag.last` as `onCancel` already does.
- evidence: read
- severity: low

## A muted or plain stacked QuantityText gives a screen reader its value twice
- where: packages/ui/src/components/QuantityText/QuantityText.tsx:82-88 (QuantityText)
- scenario: when `reads` is false (`mute` is set, or the spoken form equals the text), the stacked branch's wrapper gets no `aria-hidden`. Both the MathML and the visually hidden `<span className={s.hidden}>{text}</span>` then stay in the accessibility tree. So `<QuantityText value={tag(3/4, fraction({ form: 'stacked' }))} mute />` reads as "3 over 4, 3/4". That contradicts `mute`'s doc ("Draw no copy for a screen reader"). The hidden copy exists only for the clipboard, so it should be `aria-hidden` whenever `reads` is false.
- evidence: read
- severity: low

## Another tab's `localStorage.clear()` never reaches the recent-colors list
- where: packages/ui/src/components/RecentColors/recentColors.ts:100-102 (createRecentColorsStore, `onStorage`)
- scenario: when another tab clears storage, `StorageEvent.key` is `null`. `onStorage` only acts on `e.key === key`, so this tab keeps the old list. Its next `record` then writes the whole stale list back into the storage the other tab just cleared. It should also re-read when `e.key === null`.
- evidence: read
- severity: low

## Radio drops a consumer's `aria-describedby` whenever it has a description or a disabled reason
- where: packages/ui/src/components/RadioGroup/RadioGroup.tsx:81-83 (Radio)
- scenario: take `<Radio value="a" aria-describedby="hint" description="Fast">`. It spreads `rest`, which holds `aria-describedby="hint"`, then overwrites it with `{ 'aria-describedby': noteId }`, so the consumer's id is lost. With no note, the consumer's id survives. Whether the prop works therefore depends on an unrelated prop. The two ids should be joined.
- evidence: read
- severity: low

## RecentColorsProvider stops recording when its `store` prop goes away after mount
- where: packages/ui/src/components/RecentColors/RecentColorsProvider.tsx:20-22 (RecentColorsProvider)
- scenario: the fallback store is created only if `store` is absent on the first render. A provider that first renders with `store={a}` and later with `store={undefined}` provides `null`. Every picker beneath it then stops recording and `useRecentColors` returns an empty list. The doc says that without `store` a default store backed by `localStorage` is used, so the fallback should be created whenever `store` is absent.
- evidence: read
- severity: low

## ReorderHandle's refocus flag can outlive the move and steal focus on a later render
- where: packages/ui/src/components/ReorderHandle/ReorderHandle.tsx:40-51 (ReorderHandle)
- scenario: when `onNudge` returns `true`, `refocus.current` is set to `true`. Only the handle's next render clears it, in an effect that runs after every render. If the owner moves the item without re-rendering this handle, the flag stays set. That happens when the row is memoized and only the keyed order changes, or when the move is refused upstream after `onNudge` returned `true`. Some unrelated later render of the handle then calls `focus()`, and focus jumps back to the handle while the user is working elsewhere. The flag should be cleared on blur, or its lifetime tied to the nudge, not to whenever the handle next renders.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/PrefsSource/hooks.ts
packages/ui/src/components/PrefsSource/index.ts
packages/ui/src/components/PrefsSource/leafContext.ts
packages/ui/src/components/PrefsSource/rendererOf.ts
packages/ui/src/components/PrefsSource/types.ts
packages/ui/src/components/Pressable/Pressable.stories.tsx
packages/ui/src/components/Pressable/Pressable.tsx
packages/ui/src/components/Pressable/index.ts
packages/ui/src/components/QuantityText/QuantityText.module.css
packages/ui/src/components/QuantityText/QuantityText.stories.tsx
packages/ui/src/components/QuantityText/QuantityText.tsx
packages/ui/src/components/QuantityText/index.ts
packages/ui/src/components/RadioGroup/RadioGroup.module.css
packages/ui/src/components/RadioGroup/RadioGroup.stories.tsx
packages/ui/src/components/RadioGroup/RadioGroup.tsx
packages/ui/src/components/RadioGroup/RadioGroupAlong.tsx
packages/ui/src/components/RadioGroup/index.ts
packages/ui/src/components/RadioGroup/lab/RadioArc.stories.module.css
packages/ui/src/components/RadioGroup/lab/RadioArc.stories.tsx
packages/ui/src/components/RadioGroup/lab/RadioArcView.tsx
packages/ui/src/components/RailList/RailList.module.css
packages/ui/src/components/RailList/RailList.stories.module.css
packages/ui/src/components/RailList/RailList.stories.tsx
packages/ui/src/components/RailList/RailList.tsx
packages/ui/src/components/RailList/RailListBox.tsx
packages/ui/src/components/RailList/index.ts
packages/ui/src/components/RailList/railClass.ts
packages/ui/src/components/RecentColors/RecentColorsProvider.tsx
packages/ui/src/components/RecentColors/index.ts
packages/ui/src/components/RecentColors/recentColors.ts
packages/ui/src/components/ReorderHandle/ReorderHandle.module.css
packages/ui/src/components/ReorderHandle/ReorderHandle.tsx
packages/ui/src/components/ResizeHandle/ResizeHandle.module.css
packages/ui/src/components/ResizeHandle/ResizeHandle.stories.module.css
packages/ui/src/components/ResizeHandle/ResizeHandle.stories.tsx
packages/ui/src/components/ResizeHandle/ResizeHandle.tsx
packages/ui/src/components/ResizeHandle/index.ts
packages/ui/src/components/Ruler/Ruler.module.css
packages/ui/src/components/Ruler/Ruler.stories.module.css
packages/ui/src/components/Ruler/Ruler.stories.tsx
packages/ui/src/components/Ruler/Ruler.tsx
packages/ui/src/components/Ruler/index.ts
packages/ui/src/components/Ruler/thinLabels.ts
packages/ui/src/components/Run/index.ts
packages/ui/src/components/Run/run.tsx
packages/ui/src/components/ScaleBar/ScaleBar.module.css

<!-- done: 6 findings, files read: 46 -->
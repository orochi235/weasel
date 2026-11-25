# Audit round 60 — ui.components.part7

## RecentColorsProvider stops recording when its `store` prop is removed after mount
- where: packages/ui/src/components/RecentColors/RecentColorsProvider.tsx:20 (RecentColorsProvider)
- scenario: mount `<RecentColorsProvider store={s}>`, then re-render with `store` undefined (a consumer's store created conditionally, or dropped). The fallback is made only by the `useState` initializer at mount, when `store` was set, so `fallback` stays `null`; the context becomes `null`, every picker below silently stops recording and `useRecentColors` shows an empty list. The doc promises "Default: one createRecentColorsStore makes" whenever `store` is absent; the default should be created when it is first needed, not only at mount.
- evidence: read
- severity: low

## Recent-colors store ignores a `storage` event with `key === null`, so another tab clearing localStorage leaves this tab's list stale
- where: packages/ui/src/components/RecentColors/recentColors.ts:94 (createRecentColorsStore, onStorage)
- scenario: another tab calls `localStorage.clear()` (or site data is cleared). The browser fires `storage` with `e.key === null`; `onStorage` rereads only on `e.key === key`, so this tab keeps showing the cleared colors, and its next `record` writes them back to storage. A `null` key should also trigger the reread.
- evidence: read
- severity: low

## ReorderHandle's pending refocus outlives a nudge whose handle does not re-render, then steals focus later
- where: packages/ui/src/components/ReorderHandle/ReorderHandle.tsx:39 (ReorderHandle, refocus layout effect)
- scenario: `onNudge` returns `true`, setting `refocus.current = true`, and the parent reorders keyed rows whose row component is memoized (props unchanged), so React moves the DOM node without re-rendering the handle. The effect never runs, focus is lost to the move as the comment says, and the flag stays set; the next unrelated re-render of that handle (its `pressed` changing on selection, a label edit) calls `button.focus()` and pulls focus from wherever the user is. The flag should be consumed independently of the handle's own next render.
- evidence: read (inference about memoized callers; not reproduced)
- severity: low

## ResizeHandle commits a final size on pointer-up that `onInput` never received
- where: packages/ui/src/components/ResizeHandle/ResizeHandle.tsx:119 (ResizeHandle, onEnd)
- scenario: the pointer-up coordinate differs from the last pointermove sample (coalesced moves, a fast release). `onEnd` computes `valueAt(axisOf(ev))` and passes it only to `onChange`; the pane, driven by `onInput` as the docs direct, stays at the last move's size while the persisted value differs, so the layout jumps on next load. `onEnd` should send the settled value through `onInput` when it differs from `drag.last` (or commit `drag.last`, as `onCancel` does).
- evidence: read
- severity: low

## A stacked QuantityText that is muted exposes the value twice to a screen reader
- where: packages/ui/src/components/QuantityText/QuantityText.tsx:84 (QuantityText, stacked branch)
- scenario: `<QuantityText value={tag(3/4, fraction({ form: 'stacked' }))} mute />` (or any stacked display whose spoken form equals its text). `reads` is false, so the wrapper gets no `aria-hidden`, and both the MathML (`<mfrac>` 3 over 4) and the visually hidden copy `3/4` stay in the accessibility tree: a reader hears the value twice, in the case `mute` exists to keep quiet. The hidden copy-text span (or the MathML) should be `aria-hidden` regardless of `reads`.
- evidence: read
- severity: low

## RadioArc lab keeps a selected value the radios no longer offer when `choices` is lowered
- where: packages/ui/src/components/RadioGroup/lab/RadioArcView.tsx:42 (RadioArcView)
- scenario: pick "Huge" on the top group, then set the Choices knob to 3. The group renders Small/Medium/Large with `value="Huge"`: no radio is checked, and the State readout still reports `top: Huge`. The state should be clamped to the offered choices.
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

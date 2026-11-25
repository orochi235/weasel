# Audit round 74 — ui.components.Select

## An `over` list misaligns the selected row when that row has a description
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:62 (AlignOverTrigger, layout effect); packages/ui/src/components/Select/Select.tsx:369 (SelectItem)
- scenario: options `[{ value: 'a', label: 'A', description: 'Long note' }, …]` with `'a'` selected, `popup='over'` (the default). The measured row box is `[data-selected] .optionLabel`, and `SelectItem` puts the `OptionNote` (a `display: block` line) inside that same span. The trigger's `.value` shows only the label, because `OptionNote` renders nothing in the trigger. `over` matches the vertical centers of the two boxes, so the row's label line lands half a note-line above the trigger's text, not on it. The list moves on open, which is the thing `over` placement exists to stop. The same mismatch applies to `disabledReason` on a selected disabled row. The fix is to measure the label (the `Text slot="label"`, or a wrapper around label and icon) rather than the label plus its note.
- evidence: read
- severity: medium

## The pass cap in AlignOverTrigger never resets while the list is open, so a later change in the list's layout is never corrected
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:51 (AlignOverTrigger, `passes`)
- scenario: the list opens and settles (it can spend up to 4 passes, for example when the row's position changes while React Aria flips or clamps it). While it stays open, `options` change (font families load asynchronously, as in `useFontFamilyOptions`) or the selected row's height changes. The effect returns early at `passes.current > 3`, so the list stays at the old nudge and the selected row no longer covers the trigger. `passes` is a ref that only goes up, with no reset when the inputs it measures change, so the cap that guards against an endless loop also blocks legitimate re-measures.
- evidence: read (inference that the cap is reachable in normal use)
- severity: low

## pressRef is never cleared, so a keyboard-opened list can swallow the first click on a row
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:125 (AlignOverTrigger, pointerup listener); packages/ui/src/components/Select/Select.tsx:182 (onPointerDown)
- scenario: the user clicks the trigger to close an open list, which records a press at time T. Within `longPressMs` (500 ms by default) they reopen the list with Enter or ArrowDown, and the newly mounted list arms its capturing `pointerup` listener. The first real click on a row inside that window is still within `holdMs` of the stale press. If it lands within `dragPx` of the old press point (the row covering the trigger sits exactly there under `over`), it is `preventDefault`ed and stopped, and a `pointercancel` is dispatched, so the pick is lost. The press should be consumed (set to null) once used, or the listener armed only when the list was opened by that press.
- evidence: read (inference; the timing window is narrow)
- severity: low

## Files read
packages/ui/src/components/Select/Select.fontOptions.stories.module.css
packages/ui/src/components/Select/Select.fontOptions.stories.tsx
packages/ui/src/components/Select/Select.module.css
packages/ui/src/components/Select/Select.stories.module.css
packages/ui/src/components/Select/Select.stories.tsx
packages/ui/src/components/Select/Select.tsx
packages/ui/src/components/Select/alignOverTrigger.tsx
packages/ui/src/components/Select/index.ts
packages/ui/src/components/Select/listbox.module.css
packages/ui/src/components/Select/optionLabels.tsx

<!-- done: 3 findings, files read: 10 -->

I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole document is below, as the brief asks.

# Audit round 59 — ui.components.Properties.part2

## A debounced string field sends Escape's put-back `onInput` after `onCancel`
- where: packages/ui/src/components/Properties/fieldControls.tsx:128-141 (StringControl)
- scenario: a `kind: 'string'` field with `onInput`, `onCancel` and `inputWaitMs={300}`. Type "ab" over "x", then press Escape. `useTextDraft.keyDown` calls `p.onInput(began)`. Here that is `useDebouncedText`'s `input.type`, so "x" is only queued. `onCancel()` then runs at once, and the queued "x" reaches the caller's `onInput` afterwards, at the blur's `flush` or after the wait. The edit protocol (docs/conventions.md "Edit callbacks") says the began-from value comes *before* `onCancel`. A caller that closes its transaction on `onCancel` gets a stray preview write after closing it.
- evidence: read (fieldControls.tsx, useTextDraft.ts, useDebouncedText.ts)
- severity: medium

## An invalid color row puts its error message on the grid row its opacity track already holds
- where: packages/ui/src/components/Properties/PropertyRow.message.css:22-25 (`.rowColor > .rowError`), against PropertyRow.variants.css:57-66 and 86-95
- scenario: a `kind: 'color'` field with `alpha` inside `<RowScope error="…">`. The color field is `display: contents`, so its opacity `input[type=range]` sits at `grid-row: 2` (column 1) and its readout at row 2, column 2. `.rowError` also gets `grid-row: 2; grid-column: 1 / -1`, so the message is drawn on top of the track and readout. In `layout="block"`, rows 2 and 3 hold the swatch and the track, and the message lands on the swatch.
- evidence: read (CSS grid placement)
- severity: medium

## The auto toggle in a row's label still fires under a `<ReadOnly>` scope, but the row's reset does not
- where: packages/ui/src/components/Properties/PropertyRow.tsx:91,125 (PropertyRow / AutoToggle)
- scenario: `<ReadOnly><RowScope auto onAutoChange={setAuto} onReset={reset}><PropertyField … /></RowScope></ReadOnly>`. `ResetControl` reads `useControlAccess()` and refuses a press because "a reset changes the value, so a disabled or read-only scope stops it too" (ResetControl.tsx:25-27). `AutoToggle` only gets `useDisabled(props).disabled`, which ignores read-only. So a click on the label, or Enter/Space on it, still calls `onAutoChange(!auto)`. Unpinning hands the value back to the owner, which changes the value just as a reset does. The same question gets two answers in one row.
- evidence: read (Disabled.tsx: useDisabled vs useControlAccess)
- severity: medium

## A debounced string field's idle commit can reach `onChange` before its last `onInput`
- where: packages/ui/src/components/Properties/fieldControls.tsx:130-141 (StringControl)
- scenario: `inputWaitMs` longer than the `typing.idleMs` rest (default 800 ms), e.g. `inputWaitMs={1000}` with settle-when-idle on. Type, then stop. At 800 ms, `useTextDraft`'s idle settle calls `p.onChange(draft)` directly; only the blur/Enter `settle` path calls `input.flush()` first. The pending `onInput(draft)` then fires at 1000 ms, after the commit. That breaks the promise in fieldTypes.ts:144-145: "Whatever is waiting is sent when the edit settles, before `onChange`".
- evidence: read (useIdleSettle.ts, useTextDraft.ts idle callback)
- severity: low

## A read-only font-weight field reads `700` where its editable select reads `700 Bold`
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:54-55 (readoutBody)
- scenario: `kind: 'font-weight'`, `value={700}`, `readOnly` draws `String(700)`. The editable field's select labels the same option with `fontWeightLabel(700)`, which is `700 Bold` (FontOptions/fontOptions.ts:73-76). PropertyReadout's contract (lines 14-18) is to show "the words … the control would show", so toggling `readOnly` changes the text.
- evidence: read
- severity: low

## A read-only color field that is `unset` still shows a swatch and hex; the editable one shows none
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:41-42 (readoutBody)
- scenario: `kind: 'color'`, `unset`, `value: '#ff0000'`. `ColorControl` hides the value whenever `p.mixed || p.unset` (ColorControls.tsx:57), as `unset`'s doc requires. `readoutBody` checks only `mixed`, so the read-only form shows `#ff0000` as if it had been chosen. The number, enum and string readouts never check `unset` either. Kit callers currently pass `undefined` along with `unset`, so this only affects a direct caller.
- evidence: read
- severity: low

## A row whose `group` prop changes keeps measuring its old, detached root
- where: packages/ui/src/components/Properties/PropertyRow.tsx:197-224 (useMultiline)
- scenario: toggling `group` swaps the root between `<label>` and `<div>`, so the root element remounts. The effect depends only on `[rowRef, labelRef, enabled]`, which don't change, so it doesn't re-run. `watchResize` keeps observing the removed element, and `data-multiline` freezes at its last value. `row.children` is also captured only once, so a control replaced later isn't watched unless the row's own box also resizes.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Properties/PropertyPanel.tsx
packages/ui/src/components/Properties/PropertyReadout.module.css
packages/ui/src/components/Properties/PropertyReadout.stories.tsx
packages/ui/src/components/Properties/PropertyReadout.tsx
packages/ui/src/components/Properties/PropertyRow.auto.css
packages/ui/src/components/Properties/PropertyRow.css
packages/ui/src/components/Properties/PropertyRow.fit.css
packages/ui/src/components/Properties/PropertyRow.inline.css
packages/ui/src/components/Properties/PropertyRow.message.css
packages/ui/src/components/Properties/PropertyRow.stories.module.css
packages/ui/src/components/Properties/PropertyRow.stories.tsx
packages/ui/src/components/Properties/PropertyRow.tsx
packages/ui/src/components/Properties/PropertyRow.variants.css
packages/ui/src/components/Properties/ResetControl.css
packages/ui/src/components/Properties/ResetControl.tsx
packages/ui/src/components/Properties/RowScope.stories.tsx
packages/ui/src/components/Properties/Subpanel.css
packages/ui/src/components/Properties/Subpanel.stance.css
packages/ui/src/components/Properties/Subpanel.stories.module.css
packages/ui/src/components/Properties/Subpanel.stories.tsx
packages/ui/src/components/Properties/Subpanel.tsx
packages/ui/src/components/Properties/collapse.ts
packages/ui/src/components/Properties/family.css
packages/ui/src/components/Properties/fieldControls.tsx
packages/ui/src/components/Properties/fieldTypes.ts
packages/ui/src/components/Properties/index.ts
packages/ui/src/components/Properties/layouts.story.module.css
packages/ui/src/components/Properties/layouts.story.tsx
packages/ui/src/components/Properties/metrics.ts
packages/ui/src/components/Properties/nameOf.ts
packages/ui/src/components/Properties/rowHelp.ts
packages/ui/src/components/Properties/rowScope.tsx
packages/ui/src/components/Properties/sliderScale.ts
packages/ui/src/components/Properties/sliderStops.ts
packages/ui/src/components/Properties/unitAttach.css
packages/ui/src/components/Properties/unitSuffix.tsx

<!-- done: 7 findings, files read: 36 -->
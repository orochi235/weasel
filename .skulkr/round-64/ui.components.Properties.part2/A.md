I couldn't write the whole findings file: the first write went through, but the later writes were refused permission. `.skulkr/out/findings.md` on disk holds only the first two findings. The full document is below.

Also, commit `49e5a07e` isn't in this repo's object store, so I read the working tree as it stands. HEAD is `6f634fabe1`, and the Properties files have uncommitted changes, which I took to be the frozen snapshot.

# Audit round 64 — ui.components.Properties.part2

## A read-only number field shows its value rounded to `step`, where the editable field shows every decimal
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:76 (NumberText)
- scenario: `<PropertyField kind="number" value={0.5} readOnly />`, with control `input`, no `step` and no `display`. The readout formats with `stepDisplay(p.step)`, which is `stepDisplay(1)`, so 0 decimal places: it shows `1` (or `0`). The same field when editable goes through `NumberInput` → `UnitField`, whose default display is `FULL_PRECISION` (`UnitField.tsx:103,160`), and shows `0.5`. The docstring says the readout's words are "the ones the control would show". Only the slider control defaults to `stepDisplay`. So turning `readOnly` on changes the number shown, and a fractional value with an integer (or absent) step reads as a different value.
- evidence: read
- severity: medium

## A read-only boolean with no value reads "—", where the field's own contract and control read it as off
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:35 (readoutBody)
- scenario: `kind: 'boolean', value: undefined, readOnly`. `PropertyBooleanFieldProps.value` says "Absent reads as off" (`fieldTypes.ts:57`), and `BooleanControl` draws it as off (`fieldControls.tsx:69`, `on = p.value === true`). The readout instead returns `none()` (`—`), the same "nothing to show" form that `unset` gets. So the editable field says Off and the read-only one says unknown. The dash was a deliberate change (ac24d7b685, 2026-11-15, "show an unset read-only boolean field as the dash"). It left the prop's contract and the editable control on the old answer, so one of the two sides is now wrong.
- evidence: read
- severity: low

## Holding Space or Enter on a row's auto toggle flips the row between pinned and auto on every key repeat
- where: packages/ui/src/components/Properties/PropertyRow.tsx:274 (AutoToggle onKeyDown)
- scenario: keyboard focus is on an auto row's label toggle (`<RowScope onAutoChange>`) and the user holds Space for a moment. Each repeated `keydown` calls `toggle` → `onChange(!auto)`, and `auto` is re-read after each render. The row flips pinned/auto/pinned… and ends on whichever state the repeat count's parity gives. The code comment says the span stands in for a native button's Enter and Space, but a native button activates once, on Space's `keyup`. `e.repeat` is never checked. `ResetControl.tsx:44` has the same handler, where a repeated reset is only redundant.
- evidence: read
- severity: low

## A boolean `toggle` field in a row whose label is not a string draws an empty segment
- where: packages/ui/src/components/Properties/fieldControls.tsx:88 (BooleanControl, `control === 'toggle'`)
- scenario: `<PropertyField kind="boolean" control="toggle" label={<>Bold <kbd>⌘B</kbd></>} value onChange={…} />` with no `name` and no `glyph`. `useNameText` (`nameOf.ts:16`) falls back only to a string row label, so `text` is `undefined`, and `labelForms(undefined, p.short)` returns `[]` (`FitLabel.tsx:23`). The segment renders as a blank pressable box. `PropertyFieldBase.name` promises "Omitted, a control in a row is named by the row's label". The other boolean controls draw no text of their own, so only the toggle goes blank.
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

<!-- done: 4 findings, files read: 36 -->
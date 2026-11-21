# Audit round 64: `ui.components.Properties.part2`, blind reviewer

I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole findings document is below. Also, the frozen commit named in the brief (`49e5a07e…`) doesn't exist in this clone. I read the files at the checkout's HEAD, `6f634fabe1`.

## A read-only typed number field rounds its value to whole numbers, while the editable field shows full precision
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:76 (NumberText)
- scenario: `<PropertyField kind="number" value={2.5} readOnly />`, with control `input`, no `step` and no `display`.
  - The editable field renders through `UnitField`, whose default display is `FULL_PRECISION` (NumberField/UnitField.tsx:160). It shows `2.5`.
  - The readout falls back to `stepDisplay(p.step)` for every number field. `stepDisplay(undefined)` is `decimal({ places: 0 })` (NumberControls.tsx:106–107), so the readout shows a whole number.
  - The component promises "the words are the ones the control would show". This fallback is the slider readout's default, wrongly applied to a typed field.
  - Likewise `step={0.5}` with value `0.25`: the field shows `0.25`, the readout one decimal place.
  - Fix: use `stepDisplay` only for `control: 'slider'`, and the typed field's full-precision default otherwise.
- evidence: read
- severity: medium

## A read-only boolean with no value reads "—", while the field type and the editable control treat it as off
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:35 (readoutBody, `boolean` arm)
- scenario: `<PropertyField kind="boolean" value={undefined} readOnly />`.
  - `PropertyBooleanFieldProps.value` is documented "Absent reads as off" (fieldTypes.ts:57).
  - `BooleanControl` draws it unchecked or unselected (`on = !p.mixed && p.value === true`, fieldControls.tsx:69).
  - The readout instead draws the "nothing to show" dash. So the same field reads as off while editable and "—" once `readOnly` is set.
  - That's one decision answered two ways. "Not set" already has its own prop, `unset`, which is handled one line above.
- evidence: read
- severity: low

## A validation message that wraps marks an inline row multiline, which changes how its label and control align
- where: packages/ui/src/components/Properties/PropertyRow.tsx:214 (useMultiline)
- scenario: an inline row inside `<RowScope error="…long message…">`.
  - `message` (`.rowError`) is a direct child of the row. `tallChild` checks every child except the label against `floor * 1.5`.
  - The message sits on a line of its own (`flex: 1 0 100%`, PropertyRow.message.css:19). Once it wraps to a few lines in a narrow panel, it passes the threshold.
  - The row then gets `data-multiline`, and PropertyRow.inline.css:25–29 switches it to `align-items: first baseline`.
  - The label and the control are still on one line, but they lose their centered (or `align`-chosen) placement because the error got long.
  - Fix: leave the message (and the trailing readout) out of the tall-child test.
- evidence: read
- severity: low

## `readout={false}` or `hint={false}` draws an empty readout or hint box, and shifts an inline slider row's layout
- where: packages/ui/src/components/Properties/PropertyRow.tsx:118, 133, 151, 155 (PropertyRow)
- scenario: a caller writes `readout={auto && 'auto'}` or `hint={inherited && <From …/>}`, the usual `cond && x` pattern.
  - Each test is `!= null`, so `false` counts as given.
  - **Readout, stacked row:** an empty `<em class="readout" data-row-readout>` is drawn in the label line with `margin-left: auto`.
  - **Readout, inline row:** `trailing` is true, so an empty `.readoutAfter` is drawn. PropertyRow.fit.css:39–45 then reserves `--wzl-prop-readout-reserve` of margin on the range track and hands it back through the empty element's negative margin, so the row wraps as if a readout were there.
  - **Hint:** `false` wraps the name in `.rowName` and adds an empty `.rowHint` with `margin-inline-start` and a stray space.
  - Fix: the kit already decides "does React draw this node" in one place, `drawn()` in MotifFrame/root.ts:20. These tests should use it.
- evidence: read
- severity: low

## Files read
- packages/ui/src/components/Properties/PropertyPanel.tsx
- packages/ui/src/components/Properties/PropertyReadout.module.css
- packages/ui/src/components/Properties/PropertyReadout.stories.tsx
- packages/ui/src/components/Properties/PropertyReadout.tsx
- packages/ui/src/components/Properties/PropertyRow.auto.css
- packages/ui/src/components/Properties/PropertyRow.css
- packages/ui/src/components/Properties/PropertyRow.fit.css
- packages/ui/src/components/Properties/PropertyRow.inline.css
- packages/ui/src/components/Properties/PropertyRow.message.css
- packages/ui/src/components/Properties/PropertyRow.stories.module.css
- packages/ui/src/components/Properties/PropertyRow.stories.tsx
- packages/ui/src/components/Properties/PropertyRow.tsx
- packages/ui/src/components/Properties/PropertyRow.variants.css
- packages/ui/src/components/Properties/ResetControl.css
- packages/ui/src/components/Properties/ResetControl.tsx
- packages/ui/src/components/Properties/RowScope.stories.tsx
- packages/ui/src/components/Properties/Subpanel.css
- packages/ui/src/components/Properties/Subpanel.stance.css
- packages/ui/src/components/Properties/Subpanel.stories.module.css
- packages/ui/src/components/Properties/Subpanel.stories.tsx
- packages/ui/src/components/Properties/Subpanel.tsx
- packages/ui/src/components/Properties/collapse.ts
- packages/ui/src/components/Properties/family.css
- packages/ui/src/components/Properties/fieldControls.tsx
- packages/ui/src/components/Properties/fieldTypes.ts
- packages/ui/src/components/Properties/index.ts
- packages/ui/src/components/Properties/layouts.story.module.css
- packages/ui/src/components/Properties/layouts.story.tsx
- packages/ui/src/components/Properties/metrics.ts
- packages/ui/src/components/Properties/nameOf.ts
- packages/ui/src/components/Properties/rowHelp.ts
- packages/ui/src/components/Properties/rowScope.tsx
- packages/ui/src/components/Properties/sliderScale.ts
- packages/ui/src/components/Properties/sliderStops.ts
- packages/ui/src/components/Properties/unitAttach.css
- packages/ui/src/components/Properties/unitSuffix.tsx

<!-- done: 4 findings, files read: 36 -->
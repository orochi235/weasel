# Audit round 58: `ui.components.Field`

## A Field's error paints every frame inside it red, including controls the hook leaves valid
- where: packages/ui/src/components/Field/Field.module.css:100 (`.field[data-invalid] .frame`), with packages/ui/src/components/Field/Field.tsx:65-66 (root `data-invalid`)
- scenario: `<Field label="Name" error="Required"><Input invalid={false} /></Field>`. `useRacField` (racField.ts:24) lets the control's own `invalid={false}` win, so React Aria marks the input valid and sets no `aria-invalid`. But Field puts `data-invalid` on its root, and the descendant selector reaches the Input's `.frame`, so the frame is drawn red anyway. The same happens for a control that names itself (`aria-label`), which `useFieldControl` says "takes nothing from" the field, and for a nested `Field`/`PropertyRow` with no error of its own inside an erroring Field. "Is this control invalid?" gets one answer from the hook (valid) and another from the stylesheet (red). It should be scoped to the control the field marks, e.g. the control's own `data-invalid`/`aria-invalid`, or a child combinator.
- evidence: read
- severity: medium

## A Field's label is a `<span>`, so it neither points at the id it hands its control nor focuses it on click
- where: packages/ui/src/components/Field/Field.tsx:60 (`labelEl`), packages/ui/src/components/Field/fieldSemantics.tsx:10 (`FieldSemantics.id` doc)
- scenario: `FieldSemantics.id` is documented as "the id the control's focusable element takes, which the field's label points at", and Field generates one (`useFieldIds` → `${base}-control`) and hands it to the control. But the label Field draws is `<span id={labelId}>`, with no `htmlFor`, so nothing points at that id. In the `Row` story, `<Field orientation="row" label="Snap to grid"><NativeInput type="checkbox" /></Field>`, clicking "Snap to grid" does not toggle the checkbox, and on a stacked text field clicking the label does not focus the input. A plain `<label htmlFor>` does both, as `PropertyRow` and `UnitField` (UnitField.tsx:139) do with the same id. The name comes through `aria-labelledby`, but the click target and the documented contract are missing.
- evidence: read
- severity: low

## `label` and `description` count `null`/`false`/`''` as present, unlike `error`, so the control is named or described by an empty element
- where: packages/ui/src/components/Field/Field.tsx:56-59 (`named`, `description !== undefined`)
- scenario: Conditional slots such as `<Field label={showLabel && 'Width'} description={hint ?? null}>` (with `showLabel` false and `hint` null) give `named === true` and `description !== undefined === true`. Field then renders an empty `<span id="…-label">` and an empty `<span id="…-description">`, hands the control `aria-labelledby` and `aria-describedby` pointing at them, and adds `s.footed`. The control's accessible name comes from an empty element instead of falling back to its own `title` or `placeholder`. `error` in the same component uses `shows()`, which treats `null`, `false` and `''` as absent, so "does this slot have anything?" is answered two ways in one function. `UnitField` (UnitField.tsx:127) copies the same `!== undefined` tests.
- evidence: read
- severity: low

## The story's `NativeInput` overwrites the consumer's own id and name instead of passing them through `useFieldControl`
- where: packages/ui/src/components/Field/Field.stories.tsx:16-18 (`NativeInput`)
- scenario: The story is the reference for "a native input of a consumer's own". It spreads `{...props}` and then `{...useFieldControl()}` without handing `props` to the hook. So `<Field label="Size"><NativeInput aria-label="Width" id="w" aria-describedby="note" /></Field>` loses `id="w"` and `aria-describedby="note"` to the field's values. It also gets `aria-labelledby` added beside its own `aria-label`, and `aria-labelledby` wins, so the input reads as "Size", not "Width". The hook's own doc example (fieldSemantics.tsx:67-68) passes `props`, which merges them correctly. A consumer copying the story instead gets this broken merge.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Field/Field.module.css
packages/ui/src/components/Field/Field.stories.tsx
packages/ui/src/components/Field/Field.tsx
packages/ui/src/components/Field/fieldSemantics.tsx
packages/ui/src/components/Field/fieldSize.module.css
packages/ui/src/components/Field/fieldSize.ts
packages/ui/src/components/Field/fieldSlots.tsx
packages/ui/src/components/Field/index.ts
packages/ui/src/components/Field/mixedHint.ts
packages/ui/src/components/Field/racField.ts

<!-- done: 4 findings, files read: 10 -->

I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below. One thing to know first: this checkout's HEAD is `a22801b42b`, not the frozen commit `b400d7039e` named in the brief. The paths and line numbers below are from `a22801b42b`.

## A control's explicit `invalid={false}` overrides its Field's error in every React Aria control, but not in UnitField
- where: packages/ui/src/components/Field/racField.ts:24 (useRacField)
- scenario: `<Field label="Width" error="Too wide"><NumberField invalid={false} … /></Field>`, as a form binding produces when it passes `invalid={!!ownError}` to every control. `useRacField` computes `own.invalid ?? attrs['aria-invalid']`, so the explicit `false` wins. Input, NumberField, Select, ComboBox, TextArea and RadioGroup all render as valid, with no `isInvalid` and no `aria-invalid`, while the Field shows the error and sets `data-invalid`. UnitField answers the same question with `invalidProp || field['aria-invalid']` (packages/ui/src/components/NumberField/UnitField.tsx:135), so the same markup with a UnitField is marked invalid. The question of whether the field's error or the control's own `invalid` wins is answered two different ways. All controls should use one rule, and since the Field's error is showing on screen, that suggests `||`.
- evidence: read
- severity: medium

## An empty `label` or `description` (`null`, `false`, `''`) counts as present, though an empty `error` does not
- where: packages/ui/src/components/Field/Field.tsx:56-59 (Field); packages/ui/src/components/Field/fieldSlots.tsx:84 (NativeFieldFoot)
- scenario: `<Field label="Gain" description={hint ?? null}><Knob /></Field>` when there is no hint:
  - `description !== undefined` is true for `null`, so `useFieldIds` creates a description id.
  - NativeFieldFoot draws an empty `<span class="hint below">`, which adds an extra flex gap under the control.
  - The control's `aria-describedby` points at that empty span.
  - A row field gets the `footed` class.

  `label={null}` does the same thing: it renders an empty label span, and that span's id becomes the control's `aria-labelledby`. `error`, by contrast, goes through `shows()`, which treats `null`, `false` and `''` as no error. So the three slots disagree on what counts as empty, and `label` and `description` should be tested the same way `error` is.
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

<!-- done: 2 findings, files read: 10 -->
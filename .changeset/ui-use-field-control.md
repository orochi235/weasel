---
'@weasel-js/ui': minor
---

A control of your own takes its name, description, error and id from the `Field` or `PropertyRow` around it through the new `useFieldControl`.

Spread what it returns onto the control's focusable element. A control that names itself, by `aria-label`, `aria-labelledby` or a label of its own, takes nothing from the field. `FieldScope` sets the semantics for the controls inside it, and `value={null}` keeps a field further out from reaching them; `useFieldIds` makes the ids for a control that draws its own label, description and error.

`Input`, `TextArea`, `NumberField`, `UnitField`, `ComboBox`, `Select`, `RadioGroup`, `Slider`, `Switch` and `Checkbox` read their field this way. `Slider` gains `aria-labelledby` and `aria-describedby`.

```tsx
function Knob(props: { 'aria-label'?: string }) {
  return <div role="slider" tabIndex={0} {...useFieldControl(props)} />;
}
<Field label="Gain" description="In decibels."><Knob /></Field>
```

<!-- entry: rank=5 api new -->

---
'@weasel-js/ui': patch
---

Adds API: `disabled` on `PropertyControl` and `PropertyField`, for every kind. Each element of the control is disabled by its own `disabled` attribute or React Aria's `isDisabled`, and keeps showing its value: a checkbox, a switch, each segment of a toggle, a typed number and its steppers, a slider's track and its readout, a text field, a textarea, a select, a menu, each radio, a color swatch and its opacity track, a paint swatch, and the two font pickers. A disabled `control: 'inline'` paint draws as the swatch, since every part of the inline editor is a control. `UnitField`, `ColorField`, and `PaintField` take `disabled`, and `FontFamilySelect` and `FontWeightSelect` take `isDisabled`, as `Select` does. `prefFieldProps` takes `disabled` in its state and sets it on the control it returns, so a surface drawing a schema passes one flag.

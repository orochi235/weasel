---
'@weasel-js/ui': patch
---

A form control inside a `Field` showing an error reads as invalid even when given `invalid={false}`.

This holds for `Input`, `TextArea`, `NumberField`, `ComboBox`, `Select`, and `RadioGroup`, as it already did for `UnitField`.

<!-- entry: fix -->

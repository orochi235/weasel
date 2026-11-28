---
'@weasel-js/ui': patch
---

A control that names itself inside a `Field`, such as `<Checkbox>Accept terms</Checkbox>` or one given an `aria-label`, is still described by the field's description and error and marked invalid by its error; only its name stays its own.

<!-- entry: fix -->

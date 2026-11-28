---
'@weasel-js/ui': patch
---

A control naming itself inside a `Field` is still described by the field's description and error, and marked invalid by its error.

That covers `<Checkbox>Accept terms</Checkbox>` and a control given an `aria-label`; only the name stays its own.

<!-- entry: fix -->

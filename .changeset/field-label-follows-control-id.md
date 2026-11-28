---
'@weasel-js/ui': minor
---

A click on a `Field`'s label focuses its control when the control is given an `id` of its own, as `<Field label="Name"><Input id="name" /></Field>`.

`FieldSemantics` takes an optional `claim(id)`, which `useFieldControl` calls with the id a control takes in place of the field's, and with `undefined` when it gives it up. A component drawing its own label through `FieldScope` can pass one to keep its label's `htmlFor` on the control.

<!-- entry: fix api -->

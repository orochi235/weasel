---
'@weasel-js/ui': patch
---

`Select` gains `triggerId`, which puts an id on the trigger button. React Aria
puts a plain `id` on the wrapper element, which is not labelable, so an outer
`<label for>` had nothing to point at: the label fell through to whatever
labelable element came first inside the row. `SelectRow` passes it, so a
property row's `<label>` owns its select again rather than the ⓘ help button
beside it.

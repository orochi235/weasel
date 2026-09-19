---
'@weasel-js/ui': patch
---

`PaintInput` no longer flattens a registered paint kind that has no `Editor` into a solid color. It shows the kind's label with "no editor" and leaves the paint alone; before, touching the color field in its place replaced the paint with `{ fill: 'solid' }`. Register an `Editor` on the kind to make it editable.

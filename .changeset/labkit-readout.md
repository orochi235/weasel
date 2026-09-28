---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

labkit's new `Readout` shows values a lab only reads — measurements beside its picture, such as "Lock margin +47.9°" — from a `rows` array of `{ label, value, status? }`, with children drawn below the rows. It is a `DetailList` underneath, so its labels share the params label rail with a `ControlPanel` beside it. labkit now also re-exports `DetailList` and `DetailRow`.

`DetailList` takes `values="figures"`: each value sits right-aligned in a column at least `--wzl-detail-figure-min-width` (`8ch`) wide, in the mono face with spaces kept, so figure-space padding lines a column up on its decimal point. `DetailRow` takes a `status` (`success`, `warn` or `danger`) that draws a dot in that token's color before the value, and a row with no value now stays in place showing an en dash (or its `placeholder`) instead of an empty cell.

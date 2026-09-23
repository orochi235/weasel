---
'@weasel-js/ui': patch
---

`Select`, `Input` and `NumberField` with `orientation="row"` now lay their
label and control out side by side. Each field's own `.field` rule declared
`flex-direction: column` at the same specificity as `Field`'s shared row class
and came later in the cascade, so the row class was applied and the label still
stacked above the control. A `width="fit"` Select in a row also sizes its
trigger to its options instead of wrapping it onto its own line.

---
'@weasel-js/ui': patch
---

`Select` takes an `orientation` prop, with `Field`'s values: `'stacked'` (the default) keeps the label above the trigger, and `'row'` sets it beside the trigger at its own width, the trigger taking the rest of the row, or sitting at its fitted width with `width='fit'`. A description or error drops to a line of its own. A side-by-side label no longer needs an outer `<label htmlFor>` wired to `triggerId`.

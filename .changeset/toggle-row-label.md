---
"@weasel-js/ui": patch
---

Stop a click near a `ToggleRow`'s pin dot from selecting the row's first option.

The row was a `<label>`, and a label passes a click on its text to its first
control — for a segmented toggle, the first segment. A near-miss on the 7px
dot, or any click on the row's name, pinned the row to that option instead of
toggling auto, so an unpinned toggle could look impossible to return to auto.
`PropertyRow` now takes `group`, which renders the row as a `<div>` for a
control made of several elements, and `ToggleRow` sets it. The pin dot also
takes clicks within 5px of its edge.

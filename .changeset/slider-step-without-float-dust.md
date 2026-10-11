---
'@weasel-js/ui': patch
---

`Slider` reports a clean value for a fractional `step`. With `step={0.1}`, three steps up from 0 reached `onInput`, `onChange`, and `aria-valuenow` as `0.30000000000000004`. A stepped value is now written with the decimals its `step` and `min` carry, by the same rule `ResizeHandle` and the spin keys use.

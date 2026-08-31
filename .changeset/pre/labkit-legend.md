---
'@weasel-js/labkit': patch
---

Add `<Legend>` to `@weasel-js/labkit` — a color key for labeling what a lab
draws on its canvas.

An entry is `{ key, label, color, mark? }`. `mark` picks the swatch shape so the
key looks like the thing it names: `line` (default), `dash`, `dot` or `band`.
The color rides a `--lk-legend-ink` custom property, which lets one rule set
paint all four shapes from the same value.

Presentational only — no handlers, no state, no hover behavior. Swatches are
`aria-hidden`, leaving the label to carry the meaning.

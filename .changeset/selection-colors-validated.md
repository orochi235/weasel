---
'@weasel-js/text-dom': patch
---

The edit overlay ignores a `selectionBackground` or `selectionColor` that is not a CSS color, with a warning.

A stored value can no longer restyle the rest of the page through the overlay's `::selection` rule.

<!-- entry: fix -->

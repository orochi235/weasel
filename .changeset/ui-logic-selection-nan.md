---
"@weasel-js/ui-logic": patch
---

`selection` reads its values as `includes` does throughout, so `NaN` is one value. A single selection could never show a `NaN` item on, and reported a change on every press of it; a multiple one could turn a `NaN` item on and never off.

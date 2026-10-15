---
'@weasel-js/core': patch
---

The text Align bar no longer lights Left for `align: 'start'` (or Right for `'end'`) when the style states no `direction`. An omitted direction is `auto`, each paragraph's own, so right-to-left text aligned `start` painted from the right under a bar reading Left. The bar now lights nothing for `start` / `end` unless `direction` is `ltr` or `rtl`, and resolves them to an edge as before when it is.

---
'@weasel-js/diagram': patch
---

A decision drawn as its symbol in a `direction: 'down'` rack runs down the column: the signal enters at its top, its exits leave at its bottom, and its control inputs enter on the side the side stages hang on. `BranchOptions` takes `direction`, `'right'` or `'down'`, and `controlSide` takes `'left'` and `'right'` for a symbol running down; every symbol in `BRANCH_SYMBOLS` follows both. A symbol running down is its row form mirrored across its diagonal, so a hexagon, demux, comparator or fork draws with a path outline rather than its named one. This adds API.

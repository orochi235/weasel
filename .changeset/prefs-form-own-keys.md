---
"@weasel-js/ui": patch
---

The prefs form's filter, its rail's pages, and the schema editor's unplaced list keep a setting keyed `__proto__` as its own entry instead of losing it, and a rail path or an unplaced path naming a key every object inherits, such as `constructor`, finds nothing rather than `Object.prototype`'s function.

---
'@weasel-js/select': patch
'@weasel-js/ui': patch
---

`select()` takes a `'single'` intent, which selects the pressed id alone, and `SelectContext.eligible` is replaced by `forceSingle`, with the opposite sense: an id it holds is selected only alone. Any press on such an id resolves to `'single'`, a Shift-click included, where a range used to skip the pressed id and, with nothing else eligible, change nothing. `rangeOf`'s fourth argument takes the same `forceSingle` test. This is a breaking rename for a caller passing `eligible`. `LayerList` selects a fixed row alone on Shift-click, and Shift+arrows still pass over one.

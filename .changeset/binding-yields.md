---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A binding can say it is declared ahead of another on the same input on purpose: `opts: { yields: true }`. The route-conflict check does not report a pair whose earlier binding yields. The dispatcher already fired the next binding when an action declined through `enabled()`; this only tells the check that the order is the design. The slice tool's point drag and the keys `modeShortcuts` binds use it, so a tool set with slice in it, or a mode entered on a key another mode commits on, no longer warns. An entry key shared that way is still reported when `modeShortcuts` is given no `canEnter`, since nothing then keeps it from firing inside the other mode.

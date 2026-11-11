---
"@weasel-js/routing": patch
---

`findConflicts` and `reportRouteConflicts` judge phases as the dispatcher ranks them. Bindings whose phases differ in specificity are no longer reported, since the more specific always wins; a `phase: '*'` binding and an `initial`-only one at the same rank now are, since both fire on one keystroke.

<!-- entry: fix -->

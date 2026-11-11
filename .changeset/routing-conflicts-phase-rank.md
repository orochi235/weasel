---
"@weasel-js/routing": patch
---

`findConflicts` and `reportRouteConflicts` judge phases as the dispatcher ranks them. Two bindings whose phases differ in specificity, such as one with no phase and one limited to `initial` and `engaged` of its own tool, are no longer reported, since the more specific one always wins. A binding of either phase (`phase: '*'`) and one limited to the initial phase at the same rank are now reported, since both fire on the same keystroke.

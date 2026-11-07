---
'@weasel-js/routing': patch
---

A drag bound to an action with a `dragThresholdPx` goes to the next binding when that action declines once the threshold is crossed. It used to hold the drag to its end doing nothing, so a press another binding would have taken did nothing.

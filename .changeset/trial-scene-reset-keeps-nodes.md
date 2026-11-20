---
'@weasel-js/labkit': patch
---

`useTrialScene` keeps the loaded nodes in the trial's state when Reset or another tab's write loads over a scene that has undo history.

<!-- entry: fix data -->

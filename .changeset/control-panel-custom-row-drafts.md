---
'@weasel-js/labkit': minor
---

A `ControlPanel` given `draftConfig` hands each custom row `drafts`, so a custom row's drag is one undo step.

`drafts.setValue` writes into `draftConfig` at the row's path; the row's `setValue` then settles the drag.

<!-- entry: api -->

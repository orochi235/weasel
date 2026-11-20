---
'@weasel-js/labkit': patch
---

A lab whose old storage could not be folded into records stops persisting for the session, so the next open folds it again rather than folding it over that session's edits.

<!-- entry: fix data -->

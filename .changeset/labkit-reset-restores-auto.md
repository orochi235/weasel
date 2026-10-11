---
'@weasel-js/labkit': patch
---

A trial's Reset returned its config, state, and view to what it opened on but left which fields were `auto` as the user last had them: a field pinned since opening stayed pinned at its default, and one switched to auto stayed auto. `resetTrial` now restores the opening set too.

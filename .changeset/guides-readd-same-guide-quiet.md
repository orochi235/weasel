---
"@weasel-js/guides": patch
---

`useGuides().addGuide` with a guide equal to the one already under its id changes nothing: no new list, no re-render, and no notice to `subscribe`'s listeners.

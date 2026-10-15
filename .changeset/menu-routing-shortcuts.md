---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`actionShortcuts` now lives in `@weasel-js/routing` (core still exports it). `evaluateEnabled` takes an optional point and passes it to `Action.enabled`, so a menu can ask whether an action applies where it was opened.

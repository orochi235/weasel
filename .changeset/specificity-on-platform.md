---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
---

`specificity(spec, isMac?)` counts modifiers as the matcher resolves them on that platform, so `mod` beside the key it stands for counts once.

`isMac` is new, optional, and defaults to this platform; the dispatcher ranks and records with its own.

<!-- entry: fix api -->

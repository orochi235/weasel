---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
---

`specificity(spec, isMac?)` counts the modifier keys a spec requires as the matcher resolves them on that platform (default: this one), so `mod` beside the key it stands for counts once; the dispatcher ranks and records with its own `isMac`. The second parameter is new and optional.

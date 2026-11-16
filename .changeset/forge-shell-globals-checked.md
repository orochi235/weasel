---
'@weasel-js/forge': patch
---

`defineShellConfig` throws on a global the workshop could never show or set right, naming the key, instead of dropping it from the toolbar.

It throws when a global's `under` names a missing or nested global, when its `default` is none of its `options`, when an option's value is `'lab'`, and when `loupe.modeGlobal` names no declared global. Configs like these used to load silently; they now fail at startup.

<!-- entry: fix behavior -->

---
'@weasel-js/routing': patch
---

With a keymap open, `resolveOnly`, `resolveAll` and `explain` ask each action's `enabled` as many times as the dispatch they predict, rather than once more.

<!-- entry: fix -->

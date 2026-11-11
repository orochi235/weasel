---
"@weasel-js/audio": patch
---

A score keeps counting bars through a stall that skips steps, so it no longer repeats a bar or holds a new mood back. A bar whose first steps a stall skipped is reported at the first step it books, and `cueBar` counts any bars skipped. The pattern player's `onStep` gets a third argument, the steps since `start`, skips included.

<!-- entry: fix api -->

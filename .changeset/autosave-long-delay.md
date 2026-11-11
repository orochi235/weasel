---
"@weasel-js/editor": patch
---

`useAutosave` waits out a `delayMs` longer than 2³¹ − 1 ms, and an infinite one saves only on unmount or when the page goes away.

<!-- entry: fix -->

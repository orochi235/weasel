---
'@weasel-js/ui': patch
---

`useAsyncOptions` waits out a `debounceMs` longer than 2³¹ − 1 ms before it loads, instead of loading on each keystroke.

<!-- entry: fix -->

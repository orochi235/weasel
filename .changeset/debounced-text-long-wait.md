---
'@weasel-js/ui': patch
---

A field writing through `useDebouncedText` waits out a debounce longer than 2³¹ − 1 ms, instead of writing on each keystroke.

<!-- entry: fix -->

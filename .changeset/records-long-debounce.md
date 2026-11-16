---
'@weasel-js/storage': patch
---

A record cache holds its writes for the whole of a `debounceMs` and `maxWaitMs` longer than 2³¹ − 1 ms, and an infinite pair sends only on `flush`, instead of writing at once.

<!-- entry: fix -->

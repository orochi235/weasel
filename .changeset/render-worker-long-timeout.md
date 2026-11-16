---
'@weasel-js/core': patch
---

A render worker given a `timeout` past 2³¹ − 1 ms waits that long for an answer instead of failing every request at once.

<!-- entry: fix -->

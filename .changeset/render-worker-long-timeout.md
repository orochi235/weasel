---
'@weasel-js/core': patch
---

A render worker given a `timeout` longer than 2³¹ − 1 ms waits that long for an answer instead of counting every request lost, and the worker unresponsive, at once.

<!-- entry: fix -->

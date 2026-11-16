---
'@weasel-js/storage': patch
---

A record cache's retry backoff waits out a `retryMs` or `retryMaxMs` past 2³¹ − 1 ms instead of retrying at once.

<!-- entry: fix -->

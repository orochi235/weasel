---
'@weasel-js/storage': patch
---

A record cache's retry backoff waits out a `retryMs` or `retryMaxMs` longer than 2³¹ − 1 ms, instead of retrying a failed read or write as fast as storage answers once the backoff grows past it.

<!-- entry: fix -->

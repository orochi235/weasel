---
'@weasel-js/registry': minor
---

`createLatest` hands out tickets for async work, so an answer that lands after a newer request started can be dropped instead of overwriting it.

`take()` returns a check that holds while its request is the newest; `drop()` retires every ticket out, for an owner that has gone or an answer that arrived another way.

<!-- entry: api -->

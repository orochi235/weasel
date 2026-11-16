---
'@weasel-js/registry': minor
---

`createLatest` hands out tickets for async work, so an answer overtaken by a newer request can be dropped.

`take()` returns a check that holds while its request is the newest; `drop()` retires every ticket out, for an owner that has gone or an answer that arrived another way.

<!-- entry: api -->

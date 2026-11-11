---
"@weasel-js/labkit": patch
---

A schema's `defaults()` hands out a fresh copy of every list, object and map default on each call, so trials never share one.

<!-- entry: fix -->

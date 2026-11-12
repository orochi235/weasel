---
"@weasel-js/core": patch
---

A `registerNodeShape` disposer removes its own registration and only it, even when the same painter is registered more than once or the disposer runs twice.

<!-- entry: fix -->

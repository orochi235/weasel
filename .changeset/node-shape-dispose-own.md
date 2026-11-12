---
"@weasel-js/core": patch
---

A `registerNodeShape` disposer removes only its own registration, even when run twice or when one painter is registered twice.

<!-- entry: fix -->

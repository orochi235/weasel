---
"@weasel-js/icons": patch
---

The icon registry's `add` throws a `TypeError` for a batch holding a malformed table, before registering any of it.

A table needs a string namespace, a string owner, and an object of icons.

<!-- entry: fix -->

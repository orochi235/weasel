---
"@weasel-js/ui": patch
---

A timeline drops its selected key, reporting `null`, once the consumer changes that key's track under it.

It did so already for a selected segment; both now follow the same rule.

<!-- entry: fix -->

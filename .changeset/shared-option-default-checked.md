---
"@weasel-js/routing": patch
---

`toolOptionsPrefs` throws when a host's `shared` default is not a value the shared option takes, such as a size past every tool's maximum, instead of building a schema whose default is invalid.

<!-- entry: fix behavior -->

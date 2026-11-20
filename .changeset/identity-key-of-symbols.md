---
'@weasel-js/registry': patch
---

`identityKeyOf` gives each symbol a key of its own, so two symbols with the same description no longer share a memo or conflict key.

<!-- entry: fix -->

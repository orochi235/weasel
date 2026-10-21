---
"@weasel-js/icons-plugin": patch
---

`engines.node` now reads `>=22.12.0`, the floor its `oxc-parser` dependency declares. Node 22
releases before 22.12 were never supported; the manifest said they were.

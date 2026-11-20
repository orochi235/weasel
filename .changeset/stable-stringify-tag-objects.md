---
'@weasel-js/core': patch
---

`stableStringify` no longer writes an object shaped like its bigint or cycle tag as that tag.

An object with its own `$type` key is written as `{"$type":"object","value":…}`.

<!-- entry: fix data -->

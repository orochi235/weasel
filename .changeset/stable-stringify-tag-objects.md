---
'@weasel-js/core': patch
---

`stableStringify` no longer gives one string for a bigint or a cycle and an object shaped like its tag: an object with its own `$type` key is written as `{"$type":"object","value":…}`.

<!-- entry: fix data -->

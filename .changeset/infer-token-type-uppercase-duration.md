---
'@weasel-js/ui': patch
---

`inferTokenType` reads a duration written in upper case, such as `200MS`, as a `duration`, as it already read upper-case dimensions.

<!-- entry: fix -->

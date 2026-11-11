---
"@weasel-js/ui": patch
---

The selection panel shows a key named like an `Object.prototype` member, such as `data.toString`, as unset when the node does not hold it. Writing such a key into an array value keeps it an own key.

<!-- entry: rank=-5 fix -->

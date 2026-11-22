---
'@weasel-js/diagram-formats': patch
---

Reading DOT joins a quoted string continued with a backslash at a Windows line end, as it already did at a Unix one.

<!-- entry: fix -->

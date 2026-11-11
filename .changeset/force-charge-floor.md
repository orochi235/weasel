---
"@weasel-js/diagram": patch
---

The `force` layout no longer flings nodes that start on or near the same point thousands of units apart. Repulsion treats two bodies as at least 10 world units apart, so a stacked pair settles at the spacing a separated pair does.

<!-- entry: fix visual -->

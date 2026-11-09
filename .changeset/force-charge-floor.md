---
"@weasel-js/diagram": patch
---

`force` no longer flings nodes that start on or very near the same point thousands of units apart: repulsion now treats two bodies as at least 10 world units apart, so a stacked pair settles at the spacing a separated pair does.

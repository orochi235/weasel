---
'@weasel-js/diagram-formats': patch
---

A sequence region with no fill is written to Mermaid as `rect transparent`, so it reads back with no fill instead of a gray one.

<!-- entry: fix data -->

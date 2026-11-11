---
"@weasel-js/guides": patch
---

`measureDistances` draws no leader from a box with no height (or width) whose gap already meets the other box. It drew one running backward along that box's edge.

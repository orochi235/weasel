---
'@weasel-js/quantity': patch
---

`fraction` and `ratio` displays give a value above 1 proportionally fewer denominators to choose from, so a large value reads as a whole number or a simple fraction: 749.81 shows `750` rather than `15746/21`. Values under 1 are unchanged.

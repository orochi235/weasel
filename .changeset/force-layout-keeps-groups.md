---
'@weasel-js/diagram': patch
---

The `force` layout now reads groups: a group's members are drawn toward their centroid (`ForceOptions.groupStrength`, default 0.2), and a group's box is pushed clear of every other group's box and of every node outside it. A graph with no groups relaxes exactly as before.

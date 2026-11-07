---
'@weasel-js/diagram-elk': patch
---

`elkPlan` threw ELK's "Referenced shape does not exist" for a `Graph` whose node named a group the graph did not hold, or whose group named a missing parent: that node or group, and everything inside it, was left out of the ELK graph while edges still pointed at it. Such a node or group is now laid out at the top level.

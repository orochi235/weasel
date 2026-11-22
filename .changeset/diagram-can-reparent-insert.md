---
'@weasel-js/diagram': patch
---

`diagramCanDropInto` asks its `canReparent` about an insert too, with no ids, so a container it refuses takes no new node.

<!-- entry: fix -->

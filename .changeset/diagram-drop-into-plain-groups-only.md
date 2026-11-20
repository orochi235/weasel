---
'@weasel-js/diagram': patch
---

`diagramCanDropInto` drops a shape into a group only when the group is a region or carries no diagram trait, so a drag over a text mark or a sequence no longer reparents the shape under it.

<!-- entry: fix -->

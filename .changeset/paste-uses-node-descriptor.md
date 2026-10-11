---
'@weasel-js/core': patch
---

Pasting a node whose pose descriptor specializes per node (`PoseDescriptor.forNode`) offset it, and measured it for a drop point, through the unspecialized descriptor. `commitPaste` now reads each pasted node through its own descriptor, as moving it does.

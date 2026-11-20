---
'@weasel-js/rig': patch
---

Removing a bone also unbinds the nodes riding it whole, so a bone drawn later under the same name doesn't take them over.

Their `data.joint` is cleared in the same undo entry that drops the bone from skins.

<!-- entry: fix -->

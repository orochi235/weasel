---
'@weasel-js/core': patch
---

Copying or cutting a node that derives from hidden nodes now takes those hidden nodes onto the clipboard with it, still hidden, so a paste is whole. A path effect with `hideSources` is the case that mattered: Cut deleted its hidden sources with it, and the paste then left the effect out as `dependency-not-copied`, so cut and paste lost it. A hidden node cannot be selected, so there was no way to copy one alongside.

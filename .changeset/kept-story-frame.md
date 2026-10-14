---
'@weasel-js/forge': patch
---

An isolated story whose viewport the index cannot read, a computed size or a CSF story's `parameters.viewport`, no longer reloads its frame when first opened. The viewport arrives with the frame's `ready` and puts the story in a stage; the loaded frame now moves into it. A browser without `Element.moveBefore` still reloads the frame once.

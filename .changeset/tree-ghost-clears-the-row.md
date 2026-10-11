---
'@weasel-js/ui': patch
---

`Tree` draws a drag's ghost beside the pointer and a row's height under it, where it drew the dragged rows over the row the pointer was on and hid the branch a drop would land in. A ghost from `renderGhost` sits at the same place. The ghost also keeps the spaces between the parts of a row's label, which it collapsed.

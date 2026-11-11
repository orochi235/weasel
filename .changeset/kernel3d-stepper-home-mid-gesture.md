---
"@weasel-js/kernel3d": patch
---

A camera drag (orbit, pan, or pinch) turns on from a camera another writer set mid-gesture even when that camera is the one the dep answered with at the drag's previous move, as a `home` returning one camera object does when the drag began at home. The drag read it as a host that had not yet caught up with its own write, and its next move undid the home. A host that answers with each write at once is now known to have caught up.

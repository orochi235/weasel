---
'@weasel-js/core': patch
---

A `momentum` coast canceled on its animator (`cancelAll`, unmounting) is recorded as an undoable flick where it stopped

It ends as a new drag of the node ends it: the document takes the pose the coast reached, the flick is one history step back to where the drag began, and an adapter's `previewPoses` preview is cleared.

<!-- entry: fix -->

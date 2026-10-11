---
'@weasel-js/core': patch
---

Under a composing `poseComposition`, a derived path is now drawn between its dependencies' composed poses, where it was already picked. Before, the live canvas and `buildSceneViewCommands` resolved it from the stored local poses, so an edge between two nodes inside a moved container painted away from them.

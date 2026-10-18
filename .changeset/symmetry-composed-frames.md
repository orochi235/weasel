---
'@weasel-js/symmetry': patch
'@weasel-js/core': patch
---

Symmetry groups work in a scene that composes frames. Moving a group's center leaves its contents where they drew, though their stored poses are in the group's frame, and `bakeSymmetry` writes every original and copy as a pose local to its new parent. Core exports `scenePoseAdapter`, the `PoseAdapter` over a scene that `composeWorldPose` and `rebaseLocalPose` take.

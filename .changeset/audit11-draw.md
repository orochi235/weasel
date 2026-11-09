---
'@weasel-js/path-tools': patch
---

Path tools read grouped nodes where they draw, and click tools leave locked and hidden strokes alone.

- A constraint link tying a node inside a group is checked against that node where it draws, so a link that holds no longer reports as broken (`brokenConstraintLink`, `constraintLinkConflictsOf`) or draws its broken mark in the wrong place.
- The Smudge brush converts text inside a group to outlines when it passes over the text where it draws, not where the text would sit outside the group; a fresh warp over selected text in a group lays its controls around the text where it draws.
- Trim segment and Extend to next path, given a click, pass over a locked or hidden stroke for the one under it. Before, a click on a locked stroke tried to change it and a click over a hidden one trimmed or extended it unseen. A hidden stroke no longer cuts a trim or stops an extension.
- Link anchor never ties a dropped anchor to a hidden or locked path. `linkTargetAt` reads `isHidden` and `isLocked` from the scene it is given when the scene has them.

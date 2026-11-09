---
'@weasel-js/core': patch
---

Fixes to transforming a selection that holds a group and something inside it, and to picking inside a turned group.

- Align, distribute, flip, rotate, resize and Transform Again write a selected node once when a selected group's frame already carries it. Selecting a group and one of its children and aligning them used to move the child by the group's move and its own, landing it well past the edge both were aligned to; flipping or turning them did the same to the child twice. `useAlign` and `useDistribute` do the same under a composing `composition`.
- A node that derives only its pose (`derivePose` with no `derivePath`) inside a turned group is picked where it paints, through the group's turn, rather than by its own turn alone, which is right only for a node that derives its path.

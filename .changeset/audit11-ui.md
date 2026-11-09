---
'@weasel-js/ui': patch
'@weasel-js/ui-logic': patch
---

Fixes to right-to-left keyboard and drag handling across ui's lists, and to `EffectList` and slider stops.

- A `Tree` in a right-to-left context opens a branch with Left and closes it with Right, steps to its parent with Right, and moves rows in and out with Alt+Left and Alt+Right, mirrored from a left-to-right tree. A drag below a subtree's last row climbs out by how far the pointer sits from the tree's right edge, where it read the left edge and could not climb at all.
- An `ItemList` row's controls are walked with the arrows mirrored in a right-to-left list: Left enters them from the row and steps on across them.
- A `TokenField` mirrors its arrows in a right-to-left field: Right from the start of the text goes to the last chip, the arrows step between chips toward the side pressed, and Alt with them moves a chip that way.
- `PageTabs` moves a tab toward the arrow pressed with Alt in a right-to-left strip, where it moved it the other way.
- A foldable prefs rail folds and unfolds an entry with the arrows mirrored in a right-to-left rail, and the schema editor's icon picker steps along its grid with Left and Right swapped there.
- An `EffectList` inside another list's open card moves only its own card on Alt+Up or Alt+Down; the outer list moved its card too.
- Removing an `EffectList` card that holds focus, in a list without remove buttons, hands focus to the next card's number rather than dropping it to the page.
- A slider stop that is NaN is dropped, where it was kept and sorted the stops out of order.
- ui-logic exports `arrowDir`, which says which way an arrow key steps a list of a given orientation and direction.

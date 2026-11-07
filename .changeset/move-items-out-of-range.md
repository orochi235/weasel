---
'@weasel-js/ui-logic': patch
---

`moveItems` ignores an index outside the list entirely. Such an index used to be skipped when picking the items to move but still counted toward where they landed, so `moveItems(list, [-1, 1], 3)` put the item one place short. A gap past either end of the list is now that end.

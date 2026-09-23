---
'@weasel-js/ui': patch
---

`ItemList` takes `onSelectRange(ids)` for keyboard range selection. In a `selection="multi"` list, Shift+Up/Down and Shift+Home/End move focus and report every row from the anchor to the newly focused one, in list order. The anchor is the row last focused or activated by anything other than a range move, so a click or a plain arrow move starts a new range there. As with `onActivate`, what the range does to the selection stays with the consumer. A list without `onSelectRange` keeps treating Shift+Arrow as a plain move.

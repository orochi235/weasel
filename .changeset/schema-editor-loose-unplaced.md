---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` lists what a group root holds on no page, its own leaves and its groups that are not pages, under Unplaced, ahead of the host's `unplaced` nodes. The structure tree's General row is gone and the tree's top level holds pages only; the live preview leaves those nodes out. A row dragged from Unplaced into a page moves there, a row of the tree dragged onto the Unplaced list comes off its page, and a row picked in Unplaced shows its attributes. Unplaced is drawn for every group root, with or without `unplaced`.

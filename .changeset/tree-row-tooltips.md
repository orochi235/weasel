---
"@weasel-js/ui": patch
---

A `Tree` row can carry a tooltip. `TreeNode` takes a new `tooltip`, shown beside the row once the pointer or keyboard focus has rested on it for the kit tooltip's usual delay, and closed by a press or by leaving. A string tooltip is also the item's `aria-description`.

`PrefSchemaEditor` sets it on the rows of its Structure and Unplaced trees to each node's `description`. The Unplaced rows used a native `title` for this before.

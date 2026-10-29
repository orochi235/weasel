---
'@weasel-js/ui': patch
---

A `PrefRenderer`'s `group` may be a function of the leaf's render context, for a renderer whose control follows the leaf's own `control`: one drawing radios for one leaf and a select for another makes only the first row a group. A boolean still answers for every leaf. This adds API.

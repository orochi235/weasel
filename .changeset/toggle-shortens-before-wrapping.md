---
'@weasel-js/ui': patch
---

In an inline params row, a segmented toggle shortens its labels beside the row's label first, and takes a line of its own only once its shortest labels still overflow. `useFitScope` marks its element `data-fit-spent` when every label is at its last form and the room still overflows, until the element's parent grows wider than it was then.

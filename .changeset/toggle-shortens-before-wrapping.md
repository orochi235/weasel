---
'@weasel-js/ui': patch
---

In an inline params row, a segmented toggle shortens its labels before it takes a line of its own.

It wraps only once its shortest labels still overflow beside the row's label. `useFitScope` marks its element `data-fit-spent` when every label is at its last form and the room still overflows, until the element's parent grows wider than it was then.

<!-- entry: behavior visual api -->

---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

A `ControlMatrix` number cell shows its value the way the row's own field does: through the leaf's `display`, and with its `endless` word for infinity, where it used to print `Infinity` and ignore `.display(compact())`. `stepDisplay`, the display a number field falls back to from its `step`, is exported from `@weasel-js/ui/components/Properties`.

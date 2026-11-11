---
"@weasel-js/ui-input": patch
"@weasel-js/ui": patch
---

A slider with an endless low end steps on a grid from its range's start, not from the end stop drawn before it.

`useScale`'s new `stepOrigin` option says where the grid starts; `SliderBody` passes its range's start.

<!-- entry: fix api -->

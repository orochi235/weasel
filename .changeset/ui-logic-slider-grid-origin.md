---
"@weasel-js/ui-logic": patch
"@weasel-js/ui": patch
---

A slider with an endless low end steps on a grid from its range's start, not from the end stop drawn before it. With a range of 0 to 100, a step of 10, and the stop drawn 7 below 0, an arrow from 30 went to 43 and a drag rested on 3, 13, 23, and so on; both now land on 40 and 30. `useScale`'s new `stepOrigin` option says where the grid starts, and `SliderBody` passes its range's start.

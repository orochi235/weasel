---
'@weasel-js/ui': minor
---

`<CurveField>` takes `onInput` for the moves of a drag, sizes itself to its box when given no `width`, and takes `disabled`.

Given `onInput`, `onChange` hears only the curve a drag settles on, once, so a drag can be one undo step; without it `onChange` hears every move, as before.

<!-- entry: api -->

---
'@weasel-js/core': patch
---

While a boolean group, or a group inside one, is entered, the canvas outlines each of the children it draws only through its result, in the entered-group frame's color, so they can be found without selecting them. `useEnteredGroupFrameLayer` takes the scene for this, and `createEnteredGroupFrameLayer` takes `outlinesOf` and `outlinesChanged`. This adds API.

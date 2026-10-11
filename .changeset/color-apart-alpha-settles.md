---
'@weasel-js/ui': patch
---

`PropertyField kind="color"` with a numeric `alpha` never called `onChange` or `onAlphaChange` at the end of a gesture when the caller's `onInput` or `onAlphaInput` had already moved `value` to follow the drag, so the settled write never landed. The half the gesture moved is now committed when it ends.

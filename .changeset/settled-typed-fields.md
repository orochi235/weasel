---
'@weasel-js/ui': patch
---

A typed `PropertyField` (`number` or `string`) now calls `onChange` only once the edit settles: on blur, Enter, or a step. It used to call it on every keystroke when `onChange` was the field's only callback, so typing `150` committed `1`, `15`, and `150`, each its own undo step. A caller that wants each keystroke passes `onInput`. Sliders and color tracks still report every move when given `onChange` alone.

---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A typed `PropertyField` (`number` or `string`) now calls `onChange` only once the edit settles: on blur, Enter, or a step. It used to call it on every keystroke when `onChange` was the field's only callback, so typing `150` committed `1`, `15`, and `150`, each its own undo step. A caller that wants each keystroke passes `onInput`. Sliders and color tracks still report every move when given `onChange` alone.

`prefFieldProps` still writes where `PARAMS_SETTLES` says a surface follows typing: a lab's numbers and text, and a form's text, write through `onInput` as they are typed. labkit's `ControlPanel` keeps updating as you type, with text debounced by `debounceMs` as before.

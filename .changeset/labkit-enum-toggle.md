---
'@weasel-js/labkit': patch
---

`f.enum(...).toggle()` declares an enum drawn as segments, writing `control: 'toggle'` on its leaf. A `ControlPanel` draws it as it draws `.radio()`; a preferences form reading the same leaf draws `.toggle()` as segments and `.radio()` as radio buttons.

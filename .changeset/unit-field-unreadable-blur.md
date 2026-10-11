---
'@weasel-js/ui': patch
---

`UnitField`: typing that ends in text the field cannot read sends the value it began from through `onInput`, as Escape does. A caller holding the live value, such as a `PropertyField` number row with one callback, was left on the last keystroke that read, while the field showed the old value.

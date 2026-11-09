---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
---

A key that reports a character outside the BMP counts as one typed character: a chord on a layout that types one matches by the Latin letter its key bears, a `<select>` keeps it as type-ahead, and a binding for one typed with AltGr matches.

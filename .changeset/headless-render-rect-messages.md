---
"@weasel-js/headless": patch
---

headless refuses the same render requests the page does, with core's messages for `sourceRect` and `scale`.

They read "must be a positive finite number" and "must be a nonzero finite number".

<!-- entry: behavior -->

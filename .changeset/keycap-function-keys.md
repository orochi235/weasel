---
"@weasel-js/ui": patch
---

`KeyCap` sets a function key's legend (`F1` to `F24`) at 85% of the usual size, as a real keyboard prints it, and marks the chip `data-fn`. The size is the chip's `--key-font-size` custom property, so a consumer scaling one legend can multiply it rather than restate the token.

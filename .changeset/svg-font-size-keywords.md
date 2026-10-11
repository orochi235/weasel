---
'@weasel-js/svg': patch
---

SVG import reads the `font-size` keywords. `xx-small` through `xxx-large` take CSS's sizes for a 16px `medium`, and `larger` and `smaller` scale the parent's size by 1.2. They were read as the 16px default for `em` lengths and dropped from a text node's style.

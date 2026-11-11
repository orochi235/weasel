---
"@weasel-js/text-shaping": patch
---

`glyphD` writes an offset of 1e21 ems or more as plain digits, as its doc promises, instead of exponent notation (`-1e+21`) that an SVG path tokenizer reads as a command.

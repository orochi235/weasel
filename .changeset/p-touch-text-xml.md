---
"@weasel-js/p-touch": patch
---

The `.lbx` writer writes every hard line break in a text box (`\r\n`, `\r`, U+2028, and the rest UAX #14 names) as one line feed, where a carriage return used to read back as a second line. Text XML cannot hold (most control characters, a lone surrogate) and a font named with a tab or a break are drawn through the rasterizer, or reported as skipped without one, rather than written in a form that reads back changed.
